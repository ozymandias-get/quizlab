export function parseFromStdout(stdout: string, responseType: string): unknown | null {
    if (!stdout) return null

    let targetText = stdout;

    try {
        // Parse the CLI's -o json wrapper object
        const wrapper = JSON.parse(stdout.trim());
        if (wrapper && typeof wrapper.response === 'string') {
            targetText = wrapper.response;
        }
    } catch {
        // It's not a valid wrapper object, fallback to parsing stdout directly
    }

    try {
        const parsedInner = JSON.parse(targetText.trim());
        if (responseType === 'json-array' && !Array.isArray(parsedInner)) return null;
        return parsedInner;
    } catch {
        try {
            const firstBrace = targetText.indexOf('{');
            const firstBracket = targetText.indexOf('[');
            const lastBrace = targetText.lastIndexOf('}');
            const lastBracket = targetText.lastIndexOf(']');

            let startIndex = -1;
            let endIndex = -1;

            if (responseType === 'json-array') {
                startIndex = firstBracket;
                endIndex = lastBracket;
            } else if (responseType === 'json-object') {
                startIndex = firstBrace;
                endIndex = lastBrace;
            } else {
                const hasBrace = firstBrace !== -1 && lastBrace !== -1;
                const hasBracket = firstBracket !== -1 && lastBracket !== -1;

                if (hasBrace && hasBracket) {
                    if (firstBrace < firstBracket) {
                        startIndex = firstBrace;
                        endIndex = lastBrace;
                    } else {
                        startIndex = firstBracket;
                        endIndex = lastBracket;
                    }
                } else if (hasBrace) {
                    startIndex = firstBrace;
                    endIndex = lastBrace;
                } else if (hasBracket) {
                    startIndex = firstBracket;
                    endIndex = lastBracket;
                }
            }

            if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
                const extracted = targetText.substring(startIndex, endIndex + 1);
                const parsed = JSON.parse(extracted);
                if (responseType === 'json-array' && !Array.isArray(parsed)) return null;
                return parsed;
            }
            return null;
        } catch {
            return null;
        }
    }
}
