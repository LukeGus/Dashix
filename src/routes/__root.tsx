import {Outlet, createRootRoute} from '@tanstack/react-router'
import {GoogleOAuthProvider} from "@react-oauth/google";
import {ThemeProvider} from "@/components/ThemeProvider.tsx";

export const Route = createRootRoute({
    component: () => (
        <GoogleOAuthProvider clientId="871870849443-1402040dfqch4u79jaioo4fjqj3brc6t.apps.googleusercontent.com">
            <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
                <Outlet/>
            </ThemeProvider>
        </GoogleOAuthProvider>
    ),
})