//! QuizLab Windows 11 üst-menü kabuk eklentisi.
//!
//! Explorer'ın sağ tık menüsüne "QuizLab ile Aç" girdisini taşıyan minimal
//! `IExplorerCommand` COM sunucusu (in-proc DLL).
//!
//! DLL dosya adı (`QuizLabShellExt.dll`) bilinçli olarak PascalCase'dir.
#![allow(non_snake_case)]
//!
//! Güvenlik notları (bu kod Explorer işlemi içinde çalışır):
//! - Sıfır yan etki: yalnızca başlık/ikon döndürür ve tıklanınca
//!   `Quizlab Reader.exe` dosyasını seçili PDF yollarıyla başlatır.
//! - Ağ yok, disk yazma yok, ayar okuma yok.
//! - `Invoke` gövdesi `catch_unwind` ile sarılıdır; panik Explorer'a
//!   sıçramaz, `E_FAIL` olarak döner.

use std::ffi::c_void;
use std::os::windows::ffi::OsStrExt;
use std::sync::atomic::{AtomicU32, Ordering};

use windows::{
    core::{implement, GUID, HRESULT, IUnknown, Interface, Result, PWSTR},
    Win32::{
        Foundation::{
            CloseHandle, BOOL, CLASS_E_CLASSNOTAVAILABLE, CLASS_E_NOAGGREGATION, E_FAIL,
            E_NOTIMPL, HMODULE, S_FALSE, S_OK,
        },
        Globalization::GetUserDefaultUILanguage,
        System::{
            Com::{
                CoTaskMemAlloc, CoTaskMemFree, IBindCtx, IClassFactory, IClassFactory_Impl,
            },
            LibraryLoader::{
                GetModuleFileNameW, GetModuleHandleExW,
                GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS,
                GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
            },
            Threading::{CreateProcessW, PROCESS_INFORMATION, STARTUPINFOW},
        },
        UI::Shell::{
            ECF_DEFAULT, ECS_ENABLED, ECS_HIDDEN, IEnumExplorerCommand, IExplorerCommand,
            IExplorerCommand_Impl, IShellItem, IShellItemArray, SIGDN_FILESYSPATH,
        },
    },
};

// Identity lock: bu GUID NSIS betiği ve runtime yöneticisiyle AYNI olmalı.
// Değiştirirsen installer/installer.nsh ve shellIntegrationManager.ts dosyasını
// da güncelle (eski kurulumlar ölü girdiye düşer).
//
// {C7D9E4A1-5B2F-4C8D-9E1F-2A3B4C5D6E7F}
pub const CLSID_QUIZLAB_COMMAND: GUID =
    GUID::from_u128(0xC7D9E4A1_5B2F_4C8D_9E1F_2A3B4C5D6E7F);

const EXE_FILE_NAME: &str = "Quizlab Reader.exe";
const LANG_TURKISH_PRIMARY: u16 = 0x1F;
const TITLE_TR: &str = "QuizLab ile Aç";
const TITLE_EN: &str = "Open with QuizLab";

static DLL_LOCKS: AtomicU32 = AtomicU32::new(0);

fn is_turkish_ui() -> bool {
    (unsafe { GetUserDefaultUILanguage() } & 0x3FF) == LANG_TURKISH_PRIMARY
}

fn menu_title() -> &'static str {
    if is_turkish_ui() {
        TITLE_TR
    } else {
        TITLE_EN
    }
}

/// Rust `&str` -> COM'un beklediği null-terminated UTF-16 (CoTaskMemAlloc).
fn alloc_pwstr(text: &str) -> PWSTR {
    let wide: Vec<u16> = std::ffi::OsStr::new(text).encode_wide().chain([0]).collect();
    let bytes = wide.len() * 2;
    let ptr = unsafe { CoTaskMemAlloc(bytes) } as *mut u16;
    if ptr.is_null() {
        return PWSTR::null();
    }
    unsafe { std::ptr::copy_nonoverlapping(wide.as_ptr(), ptr, wide.len()) };
    PWSTR(ptr)
}

/// Bu DLL'in bulunduğu klasördeki `Quizlab Reader.exe` tam yolu.
fn sibling_exe_path() -> Option<String> {
    unsafe {
        let mut module = HMODULE::default();
        // Kendi modülümüzün adresinden handle al (refcount değişmez).
        GetModuleHandleExW(
            GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS
                | GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
            windows::core::PCWSTR(sibling_exe_path as *const () as *const u16),
            &mut module,
        )
        .ok()?;
        let mut buf = [0u16; 32768];
        let len = GetModuleFileNameW(module, &mut buf) as usize;
        if len == 0 || len >= buf.len() {
            return None;
        }
        let dll_path = String::from_utf16_lossy(&buf[..len]);
        let mut dir = std::path::PathBuf::from(dll_path);
        dir.pop();
        dir.push(EXE_FILE_NAME);
        dir.to_str().map(|s| s.to_owned())
    }
}

fn is_pdf(name: &str) -> bool {
    std::path::Path::new(name)
        .extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case("pdf"))
}

fn shell_item_path(item: &IShellItem) -> Option<String> {
    unsafe {
        let raw = item.GetDisplayName(SIGDN_FILESYSPATH).ok()?;
        let text = raw.to_string().ok();
        CoTaskMemFree(Some(raw.as_ptr() as *const c_void));
        text.filter(|s| !s.is_empty())
    }
}

fn selected_paths(items: &IShellItemArray) -> Vec<String> {
    let mut out = Vec::new();
    let count = unsafe { items.GetCount().unwrap_or(0) };
    for i in 0..count {
        let item = match unsafe { items.GetItemAt(i) } {
            Ok(item) => item,
            Err(_) => continue,
        };
        if let Some(path) = shell_item_path(&item) {
            out.push(path);
        }
    }
    out
}

fn quote_arg(arg: &str) -> String {
    let mut quoted = String::with_capacity(arg.len() + 2);
    quoted.push('"');
    for ch in arg.chars() {
        if ch == '"' {
            quoted.push('\\');
        }
        quoted.push(ch);
    }
    quoted.push('"');
    quoted
}

/// `"exe" "pdf1" "pdf2" ...` komut satırını kurar. Test edilebilir saf fonksiyon.
fn build_command_line(exe: &str, pdfs: &[String]) -> String {
    let mut cmd = quote_arg(exe);
    for pdf in pdfs {
        cmd.push(' ');
        cmd.push_str(&quote_arg(pdf));
    }
    cmd
}

fn wide_null(s: &str) -> Vec<u16> {
    std::ffi::OsStr::new(s).encode_wide().chain([0]).collect()
}

fn launch_quizlab(exe: &str, pdfs: &[String]) -> Result<()> {
    let cmdline = wide_null(&build_command_line(exe, pdfs));
    let mut cmd_mut = cmdline.clone();
    let mut si = STARTUPINFOW::default();
    si.cb = std::mem::size_of::<STARTUPINFOW>() as u32;
    let mut pi = PROCESS_INFORMATION::default();
    unsafe {
        CreateProcessW(
            None,
            PWSTR(cmd_mut.as_mut_ptr()),
            None,
            None,
            false,
            Default::default(),
            None,
            None,
            &si,
            &mut pi,
        )
    }?;
    unsafe {
        let _ = CloseHandle(pi.hProcess);
        let _ = CloseHandle(pi.hThread);
    }
    Ok(())
}

#[implement(IExplorerCommand)]
struct QuizLabCommand;

impl IExplorerCommand_Impl for QuizLabCommand_Impl {
    fn GetTitle(&self, _items: Option<&IShellItemArray>) -> Result<PWSTR> {
        Ok(alloc_pwstr(menu_title()))
    }

    fn GetIcon(&self, _items: Option<&IShellItemArray>) -> Result<PWSTR> {
        match sibling_exe_path() {
            Some(exe) => Ok(alloc_pwstr(&format!("{exe},0"))),
            None => Err(E_FAIL.into()),
        }
    }

    fn GetToolTip(&self, _items: Option<&IShellItemArray>) -> Result<PWSTR> {
        Err(windows::core::Error::from_hresult(E_NOTIMPL))
    }

    fn GetCanonicalName(&self) -> Result<GUID> {
        Ok(CLSID_QUIZLAB_COMMAND)
    }

    fn GetState(&self, items: Option<&IShellItemArray>, _slow: BOOL) -> Result<u32> {
        let Some(items) = items else {
            return Ok(ECS_HIDDEN.0 as u32);
        };
        // Numaralandırma başarısız olursa görünür kal (fail-visible):
        // menünün kaybolması, yanlışlıkla gösterilmesinden kötüdür.
        let count = unsafe { items.GetCount().unwrap_or(1) };
        if count == 0 {
            return Ok(ECS_HIDDEN.0 as u32);
        }
        for i in 0..count {
            let Ok(item) = (unsafe { items.GetItemAt(i) }) else {
                return Ok(ECS_ENABLED.0 as u32);
            };
            match shell_item_path(&item) {
                Some(path) if is_pdf(&path) => return Ok(ECS_ENABLED.0 as u32),
                Some(_) => continue,
                None => return Ok(ECS_ENABLED.0 as u32),
            }
        }
        Ok(ECS_HIDDEN.0 as u32)
    }

    fn GetFlags(&self) -> Result<u32> {
        Ok(ECF_DEFAULT.0 as u32)
    }

    fn EnumSubCommands(&self) -> Result<IEnumExplorerCommand> {
        Err(windows::core::Error::from_hresult(E_NOTIMPL))
    }

    fn Invoke(
        &self,
        items: Option<&IShellItemArray>,
        _bc: Option<&IBindCtx>,
    ) -> Result<()> {
        // Panik Explorer'a sıçramasın diye sar; hata E_FAIL olarak döner.
        let result = std::panic::catch_unwind(|| -> Result<()> {
            let Some(items) = items else {
                return Err(E_FAIL.into());
            };
            let pdfs: Vec<String> = selected_paths(items)
                .into_iter()
                .filter(|p| is_pdf(p))
                .collect();
            if pdfs.is_empty() {
                return Ok(());
            }
            let Some(exe) = sibling_exe_path() else {
                return Err(E_FAIL.into());
            };
            launch_quizlab(&exe, &pdfs)
        });
        match result {
            Ok(inner) => inner,
            Err(_) => Err(E_FAIL.into()),
        }
    }
}

#[implement(IClassFactory)]
struct QuizLabClassFactory;

impl IClassFactory_Impl for QuizLabClassFactory_Impl {
    fn CreateInstance(
        &self,
        outer: Option<&IUnknown>,
        iid: *const GUID,
        object: *mut *mut c_void,
    ) -> Result<()> {
        if outer.is_some() {
            return Err(CLASS_E_NOAGGREGATION.into());
        }
        let cmd: IExplorerCommand = QuizLabCommand.into();
        unsafe { cmd.query(iid, object).ok() }
    }

    fn LockServer(&self, flock: BOOL) -> Result<()> {
        if flock.as_bool() {
            DLL_LOCKS.fetch_add(1, Ordering::SeqCst);
        } else {
            DLL_LOCKS.fetch_sub(1, Ordering::SeqCst);
        }
        Ok(())
    }
}

/// DllMain'e gerek yok; COM giriş noktaları yeterli.
#[no_mangle]
pub unsafe extern "system" fn DllGetClassObject(
    rclsid: *const GUID,
    riid: *const GUID,
    ppv: *mut *mut c_void,
) -> HRESULT {
    if rclsid.is_null() || riid.is_null() || ppv.is_null() {
        return E_FAIL;
    }
    if *rclsid != CLSID_QUIZLAB_COMMAND {
        return CLASS_E_CLASSNOTAVAILABLE;
    }
    let factory: IClassFactory = QuizLabClassFactory.into();
    factory.query(riid, ppv)
}

#[no_mangle]
pub extern "system" fn DllCanUnloadNow() -> HRESULT {
    if DLL_LOCKS.load(Ordering::SeqCst) == 0 {
        S_OK
    } else {
        S_FALSE
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quotes_exe_and_each_pdf() {
        let cmd = build_command_line(
            "C:\\Program Files\\Quizlab Reader\\Quizlab Reader.exe",
            &["C:\\Docs\\a.pdf".to_owned(), "D:\\x y\\b.PDF".to_owned()],
        );
        assert_eq!(
            cmd,
            "\"C:\\Program Files\\Quizlab Reader\\Quizlab Reader.exe\" \"C:\\Docs\\a.pdf\" \"D:\\x y\\b.PDF\""
        );
    }

    #[test]
    fn escapes_embedded_quotes() {
        assert_eq!(quote_arg("a\"b"), "\"a\\\"b\"");
    }

    #[test]
    fn detects_pdf_extension_case_insensitively() {
        assert!(is_pdf("tez.PDF"));
        assert!(is_pdf("c:\\Docs\\not.pdf"));
        assert!(!is_pdf("not.pdf.exe"));
        assert!(!is_pdf("pdf"));
        assert!(!is_pdf("a.txt"));
    }

    #[test]
    fn empty_selection_builds_exe_only() {
        let cmd = build_command_line("C:\\q.exe", &[]);
        assert_eq!(cmd, "\"C:\\q.exe\"");
    }
}
