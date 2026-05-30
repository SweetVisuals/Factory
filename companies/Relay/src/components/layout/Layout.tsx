import React from 'react';
import Navigation from '../Navigation';
import AgentChatLog from '../AgentChatLog';

interface LayoutProps {
    children: React.ReactNode;
    fullHeight?: boolean; // If true, main container is flex-col and overflow-hidden (for Inbox style apps)
}

const Layout: React.FC<LayoutProps> = ({ children, fullHeight = false }) => {
    const [isChatExpanded, setIsChatExpanded] = React.useState(false);

    return (
        <div className="min-h-screen bg-background text-foreground relative flex flex-col h-screen overflow-hidden">
            {/* Top Navigation Bar */}
            <Navigation onToggleChat={() => setIsChatExpanded(!isChatExpanded)} isChatExpanded={isChatExpanded} />
            
            <div className="flex-1 flex overflow-hidden relative">
                {fullHeight ? (
                    <main className="flex-1 flex flex-col h-full overflow-hidden bg-background">
                        {children}
                    </main>
                ) : (
                    <main className="flex-1 overflow-y-auto bg-background">
                        {children}
                    </main>
                )}
                
                {/* Integrated Agent Chat Log */}
                <AgentChatLog isExpanded={isChatExpanded} onToggle={() => setIsChatExpanded(!isChatExpanded)} />
            </div>
        </div>
    );
};

export default Layout;
