import { useEffect, useState } from "react";

const useStandaloneMode = (): boolean => {
    const [isStandalone, setIsStandalone] = useState(() => {
        if (typeof window === "undefined") return false;
        return (
            window.matchMedia("(display-mode: standalone)").matches ||
            (window.navigator as any).standalone || // iOS specific
            document.referrer.includes("android-app://")
        );
    });

    useEffect(() => {
        const mediaQuery = window.matchMedia("(display-mode: standalone)");

        const handleChange = (e: MediaQueryListEvent) => {
            setIsStandalone(e.matches);
        };

        mediaQuery.addEventListener("change", handleChange);

        return () => {
            mediaQuery.removeEventListener("change", handleChange);
        };
    }, []);

    return isStandalone;
};

export default useStandaloneMode;
