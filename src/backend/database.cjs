const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");

const app = express();

const db = require(path.join(__dirname, "models", "index.cjs"));
db.sequelize.sync();

var corsOptions = {
    origin: ["http://localhost:3000", "http://localhost:8080"],
    credentials: true
};

app.use(cors(corsOptions));

// parse requests of content-type - application/json
app.use(bodyParser.json());

// parse requests of content-type - application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

// Google token verification middleware
const verifyGoogleToken = async (req, res, next) => {
    const { googleToken } = req.body;
    
    if (!googleToken) {
        return res.status(401).json({ message: "Google token required" });
    }
    
    try {
        // Verify the access token by calling Google's userinfo endpoint
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
        
        // Add verified user info to request
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

require("./routes/user.routes.cjs")(app);

// set port, listen for requests
const PORT = 8080;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}.`);
});