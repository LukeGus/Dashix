import React, { useState, useEffect } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { hyperLink } from '@uiw/codemirror-extensions-hyper-link';
import {yaml} from "@codemirror/lang-yaml";
import { Button } from "@/components/ui/button";
import { monokaiDimmed } from '@uiw/codemirror-theme-monokai-dimmed';

interface CodeEditorProps {
    content: string;
    onContentChange: (value: string) => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
    content,
    onContentChange,
}) => {
    const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
        width: window.innerWidth,
        height: window.innerHeight
    });
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            setDimensions({
                width: window.innerWidth,
                height: window.innerHeight
            });
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Calculate editor size: half width, minus gap, and full height minus top/bottom gap
    const GAP = 16; // px, adjust for desired gap
    const editorWidth = Math.max(320, (dimensions.width / 2) - (GAP * 1.5));
    const editorHeight = Math.max(200, dimensions.height - (GAP * 2));

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(content);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        } catch (e) {
            setCopied(false);
        }
    };

    return (
        <div
            style={{
                width: editorWidth,
                height: editorHeight,
                marginTop: GAP,
                marginBottom: GAP,
                marginRight: GAP,
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--background, #18181b)',
                borderRadius: 8,
                overflow: 'hidden',
                position: 'relative',
            }}
        >
            {/* Copy button in top right */}
            <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="absolute top-2 right-2 z-10 border-2 border-primary shadow-lg bg-background hover:bg-primary/20 active:bg-primary/30 transition-colors"
                title={copied ? "Copied!" : "Copy to clipboard"}
                aria-label="Copy code"
                type="button"
            >
                {/* Clipboard SVG icon */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15V5a2 2 0 0 1 2-2h10"></path></svg>
            </Button>
            <CodeMirror
                value={content}
                height={`100%`}
                width={`100%`}
                theme={monokaiDimmed}
                editable={false}
                extensions={[
                    yaml(),
                    hyperLink,
                ]}
                onChange={(value: string) => onContentChange(value)}
                basicSetup={{ lineNumbers: true }}
                style={{
                    flex: 1,
                    minHeight: 0,
                    minWidth: 0,
                    fontSize: 16,
            }}
            />
        </div>
    );
};