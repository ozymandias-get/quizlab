//! Explorer'a dokunmadan COM boru hattını doğrular:
//! DLL dosyası yüklenir, `DllGetClassObject` üzerinden `IExplorerCommand`
//! üretilir ve başlık/ikon/durum sorguları çalıştırılır.
//!
//! CI'da Windows koşucusunda da çalışır (pencere açılmaz, kayıt defteri
//! yazılmaz).

use std::ffi::c_void;
use std::path::PathBuf;

use windows::{
    core::{Interface, GUID, HRESULT},
    Win32::{
        Foundation::{FreeLibrary, HMODULE, S_OK},
        System::{
            Com::IClassFactory,
            LibraryLoader::{GetProcAddress, LoadLibraryW},
        },
        UI::Shell::IExplorerCommand,
    },
};

const CLSID_QUIZLAB_COMMAND: GUID = GUID::from_u128(0xC7D9E4A1_5B2F_4C8D_9E1F_2A3B4C5D6E7F);

type DllGetClassObjectFn =
    unsafe extern "system" fn(*const GUID, *const GUID, *mut *mut c_void) -> HRESULT;
type DllCanUnloadNowFn = unsafe extern "system" fn() -> HRESULT;

fn wide_null(s: &str) -> Vec<u16> {
    use std::os::windows::ffi::OsStrExt;
    std::ffi::OsStr::new(s).encode_wide().chain([0]).collect()
}

/// Test çalıştırılabilir dosyasının yanındaki derlenmiş DLL'i bulur
/// (`target/{debug,release}/deps/` → iki üst dizin).
fn find_built_dll() -> PathBuf {
    let exe = std::env::current_exe().expect("current_exe");
    let mut dir = exe.parent().expect("deps dir").to_path_buf();
    // deps/ -> {profile}/ -> target/
    dir.pop();
    let dll = dir.join("QuizLabShellExt.dll");
    assert!(
        dll.exists(),
        "built DLL not found at {} (run cargo build/test first)",
        dll.display()
    );
    dll
}

/// DLL'i sahte bir kurulum klasörüne kopyalar (yanında boş bir
/// `Quizlab Reader.exe` ile) ve yükler. Gerçek kuruluma dokunulmaz.
struct StagedDll {
    module: HMODULE,
    _dir: PathBuf,
}

fn stage_and_load() -> StagedDll {
    let src = find_built_dll();
    let dir = std::env::temp_dir().join("quizlab-shell-ext-test");
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).expect("temp dir");
    std::fs::copy(&src, dir.join("QuizLabShellExt.dll")).expect("copy dll");
    // GetIcon yol çözümlemesi için aynı klasörde exe adı yeterli
    // (varlık kontrolü yapılmaz, yalnızca yol kurulur).
    std::fs::write(dir.join("Quizlab Reader.exe"), b"").expect("dummy exe");

    let path = wide_null(&dir.join("QuizLabShellExt.dll").to_string_lossy());
    let module =
        unsafe { LoadLibraryW(windows::core::PCWSTR(path.as_ptr())) }.expect("LoadLibraryW");
    StagedDll { module, _dir: dir }
}

unsafe fn get_proc(module: HMODULE, name: &str) -> *mut c_void {
    // PCSTR null-terminated olmalı.
    let cname = format!("{name}\0");
    let proc = unsafe { GetProcAddress(module, windows::core::PCSTR(cname.as_ptr())) };
    let addr: *mut c_void = match proc {
        Some(f) => f as *mut c_void,
        None => std::ptr::null_mut(),
    };
    assert!(!addr.is_null(), "export missing: {name}");
    addr
}

#[test]
fn com_pipeline_serves_title_icon_state() {
    let staged = stage_and_load();

    unsafe {
        let get_class_object: DllGetClassObjectFn =
            std::mem::transmute(get_proc(staged.module, "DllGetClassObject"));
        let can_unload_now: DllCanUnloadNowFn =
            std::mem::transmute(get_proc(staged.module, "DllCanUnloadNow"));

        let mut factory_ptr: *mut c_void = std::ptr::null_mut();
        let hr = get_class_object(
            &CLSID_QUIZLAB_COMMAND,
            &IClassFactory::IID,
            &mut factory_ptr,
        );
        assert_eq!(hr, S_OK, "DllGetClassObject failed");
        assert!(!factory_ptr.is_null());

        let factory = IClassFactory::from_raw(factory_ptr as *mut _);
        let cmd: IExplorerCommand = factory
            .CreateInstance(None)
            .expect("CreateInstance");

        // Başlık: makine diline göre TR veya EN.
        // PWSTR, CoTaskMem belleğinden deterministik şekilde elle okunur.
        let title_pw = cmd.GetTitle(None).expect("GetTitle");
        assert!(!title_pw.is_null(), "GetTitle returned null");
        let len = title_pw.len();
        assert!((1..256).contains(&len), "implausible title len: {len}");
        let wide: &[u16] = std::slice::from_raw_parts(title_pw.0, len);
        let title = String::from_utf16(wide).expect("title");
        assert!(
            title == "QuizLab ile Aç" || title == "Open with QuizLab",
            "unexpected title: {title}"
        );

        // Kanonik ad: kayıtlı CLSID ile birebir aynı olmalı.
        let canonical = cmd.GetCanonicalName().expect("GetCanonicalName");
        assert_eq!(canonical, CLSID_QUIZLAB_COMMAND);

        // İkon: sahnelenen klasördeki exe'yi göstermeli.
        let icon = cmd.GetIcon(None).expect("GetIcon").to_string().expect("icon");
        assert!(
            icon.ends_with("Quizlab Reader.exe,0"),
            "unexpected icon: {icon}"
        );

        // Seçim yoksa gizli, bayraklar varsayılan, alt komut yok.
        let state = cmd.GetState(None, false).expect("GetState");
        assert_eq!(state, 2, "expected ECS_HIDDEN without selection");
        assert_eq!(cmd.GetFlags().expect("GetFlags"), 0);
        assert!(cmd.EnumSubCommands().is_err());

        // Yanlış CLSID reddedilmeli.
        let mut bad_ptr: *mut c_void = std::ptr::null_mut();
        let bad_clsid = GUID::from_u128(0x00000000_0000_0000_0000_000000000000);
        let hr = get_class_object(&bad_clsid, &IClassFactory::IID, &mut bad_ptr);
        assert!(hr.is_err(), "wrong CLSID should fail");
        assert!(bad_ptr.is_null());

        assert_eq!(can_unload_now(), S_OK);

        // from_raw sahipliği alır; Drop otomatik Release çağırır.
        // Arayüzler DLL boşaltılmadan ÖNCE bırakılmalı, yoksa Drop
        // boşaltılmış vtable'a dokunur (teardown AV).
        drop(cmd);
        drop(factory);
        let _ = FreeLibrary(staged.module);
    }
}
