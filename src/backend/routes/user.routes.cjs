module.exports = app => {
    const user = require("../controllers/user.controller.cjs");
    var router = require("express").Router();
    const { verifyGoogleToken } = require("../middleware/verifyGoogleToken.cjs");

    // Create a new user (protected)
    router.post("/", verifyGoogleToken, user.create);

    // Retrieve all users
    router.get("/", user.findAll);

    // Retrieve a single user with id
    router.get("/:id", user.findOne);

    // Update a user with id
    router.put("/:id", user.update);

    // Delete a user with id
    router.delete("/:id", user.delete);

    // Delete all users
    router.delete("/", user.deleteAll);

    app.use('/api/user', router);
};