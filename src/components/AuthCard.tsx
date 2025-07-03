import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {useGoogleLogin} from "@react-oauth/google";
import {useState, useEffect} from "react";
import UserService from "./backend/user"

export function AuthCard({ isHidden, setIsHidden }: { isHidden: boolean, setIsHidden: (hidden: boolean) => void }) {
    const [userInfo, setUserInfo] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [userLoaded, setUserLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Auto-login on component mount
    useEffect(() => {
        const savedUserInfo = localStorage.getItem('userInfo');
        const savedToken = localStorage.getItem('googleToken');
        
        if (savedUserInfo && savedToken) {
            try {
                const user = JSON.parse(savedUserInfo);
                setUserInfo(user);
                setUserLoaded(true);
                
                // Verify the user still exists in our database
                UserService.get(user.id).catch(() => {
                    // If user doesn't exist in DB, clear local storage
                    localStorage.removeItem('userInfo');
                    localStorage.removeItem('googleToken');
                    setUserInfo(null);
                    setUserLoaded(false);
                });
            } catch (error) {
                console.error('Error parsing saved user info:', error);
                localStorage.removeItem('userInfo');
                localStorage.removeItem('googleToken');
            }
        }
    }, []);

    const login = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            const accessToken = tokenResponse.access_token;

            if (!accessToken) {
                console.error('No access token received');
                setIsLoading(false);
                setError('No access token received');
                return;
            }

            try {
                setError(null);
                
                // Get user info from Google
                const res = await fetch(
                    'https://www.googleapis.com/oauth2/v1/userinfo?alt=json',
                    {
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                        },
                    }
                );

                if (!res.ok) {
                    throw new Error('Failed to fetch user info');
                }

                const data = await res.json();
                
                // For now, we'll use the access token as the verification token
                // In production, you should configure Google OAuth to return ID tokens
                localStorage.setItem('googleToken', accessToken);
                localStorage.setItem('userInfo', JSON.stringify(data));
                
                setUserInfo(data);

                // Create user in our database
                try {
                    await UserService.create(data);
                    setUserLoaded(true);
                } catch (apiError: any) {
                    if (apiError.response?.status === 409) {
                        // User already exists, that's fine
                        setUserLoaded(true);
                    } else {
                        throw apiError;
                    }
                }

            } catch (error: any) {
                console.error('Error during login:', error);
                setError(error.message || 'Login failed');
                localStorage.removeItem('userInfo');
                localStorage.removeItem('googleToken');
            }

            setIsLoading(false);
        },
        scope: "openid email profile",
        flow: "implicit",
        onError: (error) => {
            console.error("Login failed:", error);
            setError('Login failed');
            setIsLoading(false);
        },
        onNonOAuthError: (error) => {
            console.error("Non auth error:", error);
            setError('Authentication error');
            setIsLoading(false);
        }
    });

    const handleLoginClick = () => {
        setIsLoading(true);
        setError(null);
        login();
    };

    const handleLogout = () => {
        localStorage.removeItem('userInfo');
        localStorage.removeItem('googleToken');
        setUserInfo(null);
        setUserLoaded(false);
        setError(null);
    };

    return (
        <>
            {!isHidden && (
                <div
                    className="fixed inset-0 flex items-center justify-center z-50 bg-black/40"
                    onClick={e => {
                        if (e.target === e.currentTarget) setIsHidden(true);
                    }}
                >
                    <Card
                        className="w-full max-w-md z-10 shadow-2xl relative"
                        style={{
                            backgroundColor: "#18181b",
                        }}
                    >
                        <button
                            onClick={() => setIsHidden(true)}
                            className="absolute top-3 right-3 text-gray-400 hover:text-white text-xl font-bold focus:outline-none"
                            aria-label="Close"
                        >
                            ×
                        </button>
                        <CardHeader>
                            <CardTitle>Account</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {error && (
                                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded text-red-300 text-sm">
                                    {error}
                                </div>
                            )}
                            
                            {!userInfo ? (
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={handleLoginClick}
                                    disabled={isLoading}
                                    style={{
                                        backgroundColor: "#27272a",
                                    }}
                                >
                                    {isLoading ? "Logging in..." : "Login with Google"}
                                </Button>
                            ) : (
                                <div className="space-y-4">
                                    <div className="text-center">
                                        <img 
                                            src={userInfo.picture} 
                                            alt="User avatar" 
                                            className="w-16 h-16 rounded-full mx-auto mb-2"
                                        />
                                        <p className="font-medium">{userInfo.name}</p>
                                        <p className="text-sm text-gray-400">{userInfo.email}</p>
                                    </div>
                                    
                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        onClick={handleLogout}
                                        style={{
                                            backgroundColor: "#27272a",
                                        }}
                                    >
                                        Logout
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </>
    );
}