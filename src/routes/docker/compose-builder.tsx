import {createFileRoute} from '@tanstack/react-router'
import {ThemeProvider} from "@/components/ThemeProvider.tsx"

export const Route = createFileRoute('/docker/compose-builder')({
    component: App,
})

function App() {
    return (
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <div className="flex min-h-screen">
                <main className="flex">

                </main>
            </div>
        </ThemeProvider>
    );
}