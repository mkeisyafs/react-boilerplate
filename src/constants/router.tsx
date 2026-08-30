import { createBrowserRouter } from "react-router-dom"
import Example from "../pages/example"

const router = createBrowserRouter([
    {
        path: "/",
        element: <Example />
    }
])

export default router;
