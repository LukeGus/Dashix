import {Outlet, createRootRoute} from '@tanstack/react-router'
import {GoogleOAuthProvider} from "@react-oauth/google";
import {SidebarUI} from "@/components/SidebarUI.tsx";

export const Route = createRootRoute({
    component: () => (
        <GoogleOAuthProvider clientId="871870849443-1402040dfqch4u79jaioo4fjqj3brc6t.apps.googleusercontent.com">
            <div className="flex min-h-screen">
                <SidebarUI/>
            </div>
            <Outlet/>
        </GoogleOAuthProvider>
    ),
})
