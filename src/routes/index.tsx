import {createFileRoute} from '@tanstack/react-router'
import {ThemeProvider} from "@/components/ThemeProvider.tsx";
import {SidebarUI} from "@/components/SidebarUI.tsx";

export const Route = createFileRoute('/')({
    component: App,
})

function App() {
    return (
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <SidebarUI />
        </ThemeProvider>
    )
}