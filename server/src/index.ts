import { validateServerEnvironment } from './env.js'
import app from './app.js'

validateServerEnvironment()
const port = Number(process.env.PORT || 4000)
app.listen(port, () => console.log('Library API listening on port ' + port))
