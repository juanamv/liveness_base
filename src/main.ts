import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";

const app = express();
const PORT = 3000;

// Crear directorio de uploads si no existe
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware to parse JSON
app.use(express.json({ limit: '10mb' }));

// Servir archivos estáticos desde la carpeta public
app.use(express.static(path.join(__dirname, '../public')));

// Simple route
app.get("/", (req: Request, res: Response) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sistema de Verificación de Vida</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            .container {
                text-align: center;
                background: white;
                padding: 40px;
                border-radius: 15px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                max-width: 500px;
            }
            h1 {
                color: #333;
                margin-bottom: 20px;
                font-size: 2.5em;
            }
            p {
                color: #666;
                font-size: 1.1em;
                margin-bottom: 30px;
                line-height: 1.6;
            }
            .btn {
                display: inline-block;
                background: linear-gradient(45deg, #667eea, #764ba2);
                color: white;
                padding: 15px 30px;
                text-decoration: none;
                border-radius: 25px;
                font-size: 1.2em;
                font-weight: bold;
                transition: transform 0.3s ease, box-shadow 0.3s ease;
                margin: 10px;
            }
            .btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            }
            .features {
                margin: 30px 0;
                text-align: left;
            }
            .feature {
                margin: 10px 0;
                color: #555;
            }
            .feature:before {
                content: "✓ ";
                color: #28a745;
                font-weight: bold;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🔒 Verificación de Vida</h1>
            <p>Sistema de autenticación biométrica con detección de vida en tiempo real</p>
            
            <div class="features">
                <div class="feature">Detección facial en tiempo real</div>
                <div class="feature">Verificación de movimientos de cabeza</div>
                <div class="feature">Captura automática de fotografías</div>
                <div class="feature">Procesamiento seguro de datos</div>
            </div>
            
            <a href="/face-test" class="btn">🚀 Iniciar Verificación</a>
        </div>
    </body>
    </html>
  `);
});

// Ruta para la prueba de face-api.js
app.get("/face-test", (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/face-test.html'));
});

// Endpoint para recibir y guardar fotografías de liveness
app.post("/api/save-liveness-photo", (req: Request, res: Response) => {
  try {
    const { imageData, step, timestamp } = req.body;
    
    if (!imageData || !step) {
      return res.status(400).json({ 
        success: false, 
        message: 'Faltan datos requeridos (imageData, step)' 
      });
    }

    // Remover el prefijo data:image/png;base64, si existe
    const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
    
    // Crear nombre de archivo único
    const filename = `liveness-${step}-${timestamp || Date.now()}.png`;
    const filepath = path.join(uploadsDir, filename);
    
    // Guardar la imagen
    fs.writeFileSync(filepath, base64Data, 'base64');
    
    console.log(`Fotografía guardada: ${filename} para paso: ${step}`);
    
    res.json({
      success: true,
      message: 'Fotografía guardada exitosamente',
      filename: filename,
      step: step
    });
    
  } catch (error) {
    console.error('Error guardando fotografía:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
