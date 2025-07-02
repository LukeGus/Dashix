import {Outlet, createRootRoute} from '@tanstack/react-router'
import {GoogleOAuthProvider} from "@react-oauth/google";
import {SidebarUI} from "@/components/SidebarUI.tsx";
import {ThemeProvider} from "@/components/ThemeProvider.tsx";

export const Route = createRootRoute({
    component: () => (
        <GoogleOAuthProvider clientId="871870849443-1402040dfqch4u79jaioo4fjqj3brc6t.apps.googleusercontent.com">
            <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
                <div className="flex min-h-screen">
                    <SidebarUI/>
                </div>
                <Outlet/>
            </ThemeProvider>
        </GoogleOAuthProvider>
    ),
})
