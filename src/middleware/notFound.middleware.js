export default function notFound(req, res, next) {

    res.status(404).json({
        status: "error",
        message: `Route ${req.originalUrl} not found`
    });

}