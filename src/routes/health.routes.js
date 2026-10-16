import { Router } from "express";

const router = Router();


router.get("/", (req, res) => {

    res.json({
        status: "success",
        service: "Evault Core API",
        message: "System is healthy",
        timestamp: new Date()
    });

});


export default router;