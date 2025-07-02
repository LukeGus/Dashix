import {createFileRoute} from '@tanstack/react-router'
import {SidebarUI} from '@/components/SidebarUI.tsx'
import {ThemeProvider} from "@/components/ThemeProvider.tsx"

export const Route = createFileRoute('/')({
    component: App,
})

function App() {
    return (
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <div className="flex min-h-screen">
                <SidebarUI />
                <main className="flex">

                </main>
            </div>
        </ThemeProvider>
    );
}
