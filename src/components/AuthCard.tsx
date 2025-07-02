import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {useGoogleLogin} from "@react-oauth/google";
import {useState} from "react";

export function AuthCard() {
    const [userInfo, setUserInfo] = useState(null);
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
        <div className="flex items-center justify-center min-h-screen">
            <Card
                className="w-full max-w-sm z-10"
                style={{
                    backgroundColor: "#18181b",
                }}
            >
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
                        {isLoading ? "Logging in..." : userInfo ? "Logged in with Google" : "Login with Google"}
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
    );
}