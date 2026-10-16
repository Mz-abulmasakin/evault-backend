import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";


export function securityMiddleware(app) {

    app.use(helmet());

    app.use(cors({
        origin: "*"
    }));

    app.use(morgan("dev"));

}