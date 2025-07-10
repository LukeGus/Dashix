import {createFileRoute} from '@tanstack/react-router'
import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';

export const Route = createFileRoute('/')({
    component: App,
})

function App() {
    const navigate = useNavigate();
    useEffect(() => {
        navigate({ to: '/docker/compose-builder', replace: true });
    }, [navigate]);
    return null;
}