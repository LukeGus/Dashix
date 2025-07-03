const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const verifyGoogleToken = async (req, res, next) => {
    const { googleToken } = req.body || {};
    if (!googleToken) {
        return res.status(401).json({ message: "Google token required" });
    }
    try {
        const response = await fetch(
            'https://www.googleapis.com/oauth2/v1/userinfo?alt=json',
            {
                headers: {
                    Authorization: `Bearer ${googleToken}`,
                },
            }
        );
        if (!response.ok) {
            return res.status(401).json({ message: "Invalid Google token" });
        }
        const data = await response.json();
        req.verifiedUser = {
            googleId: data.id,
            email: data.email,
            name: data.name
        };
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        return res.status(401).json({ message: "Token verification failed" });
    }
};

module.exports = { verifyGoogleToken }; 