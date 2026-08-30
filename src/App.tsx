import { RouterProvider } from "react-router-dom"
import router from "./constants/router"

const App = () => {
    return (
        <RouterProvider router={router} />
    )
}

export default App