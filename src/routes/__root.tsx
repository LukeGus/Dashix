import {Outlet, createRootRoute} from '@tanstack/react-router'
import {ThemeProvider} from "@/components/ThemeProvider.tsx";

export const Route = createRootRoute({
    component: () => (
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <Outlet/>
        </ThemeProvider>
    ),
})