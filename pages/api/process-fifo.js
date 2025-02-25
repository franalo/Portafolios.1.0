import formidable from "formidable"
import fs from "fs"
import { procesarFIFO } from "../../scripts/fifoPipeline.js"

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Método no permitido" })
  }

  const uploadDir = "./public/uploads"
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true })
  }

  const form = formidable({
    uploadDir: uploadDir,
    keepExtensions: true,
  })

  return new Promise((resolve, reject) => {
    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error("Error al parsear el formulario:", err)
        res.status(500).json({ message: "Error al procesar el archivo" })
        return resolve()
      }

      try {
        const filePath = files.file?.[0]?.filepath
        if (!filePath) {
          res.status(400).json({ message: "No se recibió un archivo válido" })
          return resolve()
        }

        const result = await procesarFIFO(filePath)

        if (result.success) {
          const fileUrl = `/uploads/${result.outputFileName}`

          // Crear el HTML con la animación y el nuevo mensaje
          const htmlResponse = `
            <!DOCTYPE html>
            <html lang="es">
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Archivo Procesado</title>
                <link rel="stylesheet" href="/style-upload.css">
                <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&display=swap" rel="stylesheet">
              </head>
              <body>
                <div class="container">
                  <div class="success-animation">
                    <div class="checkmark-container">
                      <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                        <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
                        <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                      </svg>
                    </div>
                    <h2 class="success-message">Datos Procesados Correctamente</h2>
                  </div>
                  <p class="status-message success">${result.message}</p>
                  <div class="result-container">
                    <a href="${fileUrl}" class="download-link" download="${result.outputFileName}">
                      <i class="fas fa-download"></i> Descargar Archivo Procesado
                    </a>
                    <button onclick="window.location.href='/Visu/index.html'" class="visu-button">
                      <i class="fas fa-chart-bar"></i> Ir a Visualización
                    </button>
                  </div>
                </div>
              </body>
            </html>
          `

          res.status(200).send(htmlResponse)
        } else {
          res.status(500).json({
            success: false,
            message: result.message,
          })
        }
        resolve()
      } catch (error) {
        console.error("Error en el procesamiento del archivo:", error)
        res.status(500).json({ message: `Error en el procesamiento: ${error.message}` })
        resolve()
      }
    })
  })
}