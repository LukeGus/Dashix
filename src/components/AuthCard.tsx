import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {useGoogleLogin} from "@react-oauth/google";
import {useState} from "react";

export function AuthCard({ isHidden, setIsHidden }: { isHidden: boolean, setIsHidden: (hidden: boolean) => void }) {
    const [userInfo, setUserInfo] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [userLoaded, setUserLoaded] = useState(false);

    const login = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            const accessToken = tokenResponse.access_token;

            if (!accessToken) {
                console.error('No access token received');
                setIsLoading(false);
                return;
            }

            try {
                const res = await fetch(
                    'https://www.googleapis.com/oauth2/v1/userinfo?alt=json',
                    {
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                        },
                    }
                );

                if (!res.ok) {
                    setIsLoading(false);
                    throw new Error('Failed to fetch user info');
                }

                const data = await res.json();
                setUserInfo(data);
                setUserLoaded(true);
            } catch (error) {
                console.error('Error fetching user info:', error);
            }

            setIsLoading(false);
        },
        onError: (error) => {
            console.error("Login failed:", error);
            setIsLoading(false);
        },
        onNonOAuthError: (error) => {
            console.error("Non auth error:", error);
            setIsLoading(false);
        }
    });

    const handleLoginClick = () => {
        setIsLoading(true);
        login();
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
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={handleLoginClick}
                                disabled={isLoading || userLoaded}
                                style={{
                                    backgroundColor: "#27272a",
                                }}
                            >
                                {isLoading
                                    ? "Logging in..."
                                    : userInfo
                                        ? "Logged in with Google"
                                        : "Login with Google"}
                            </Button>

                            {userInfo && (
                                <div>
                                    <h3>User Info</h3>
                                    <img src={userInfo.picture} alt="User avatar" />
                                    <p>Name: {userInfo.name}</p>
                                    <p>Email: {userInfo.email}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </>
    );
}