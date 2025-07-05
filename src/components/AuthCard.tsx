import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {useGoogleLogin} from "@react-oauth/google";
import {useState, useEffect} from "react";
import UserService from "./backend/user"

export function AuthCard({ isHidden, setIsHidden }: { isHidden: boolean, setIsHidden: (hidden: boolean) => void }) {
    const [userInfo, setUserInfo] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const savedUserInfo = localStorage.getItem('userInfo');
        const savedToken = localStorage.getItem('googleToken');
        
        if (savedUserInfo && savedToken) {
            try {
                const user = JSON.parse(savedUserInfo);
                setUserInfo(user);

                UserService.get(user.id).catch(() => {
                    localStorage.removeItem('userInfo');
                    localStorage.removeItem('googleToken');
                    setUserInfo(null);
                });
            } catch (error) {
                localStorage.removeItem('userInfo');
                localStorage.removeItem('googleToken');
            }
        }
    }, []);

    const login = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            const accessToken = tokenResponse.access_token;

            if (!accessToken) {
                setIsLoading(false);
                setError('No access token received');
                return;
            }

            try {
                setError(null);

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

                localStorage.setItem('googleToken', accessToken);
                localStorage.setItem('userInfo', JSON.stringify(data));
                
                setUserInfo(data);

                try {
                    await UserService.create(data);
                } catch (apiError: any) {
                    if (apiError.response?.status === 409) {
                    } else {
                        throw apiError;
                    }
                }

            } catch (error: any) {
                setError(error.message || 'Login failed');
                localStorage.removeItem('userInfo');
                localStorage.removeItem('googleToken');
            }

            setIsLoading(false);
        },
        scope: "openid email profile",
        flow: "implicit",
        onError: () => {
            setError('Login failed');
            setIsLoading(false);
        },
        onNonOAuthError: () => {
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