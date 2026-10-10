from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import numpy as np
import tensorflow as tf
import io
import logging
import os

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Inicializar app
app = FastAPI(title="API Predicción MNIST")

# Configurar CORS - IMPORTANTE: Permite todas las conexiones
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permite cualquier origen
    allow_credentials=True,
    allow_methods=["*"],  # Permite todos los métodos (GET, POST, etc.)
    allow_headers=["*"],  # Permite todos los headers
)

# Cargar modelo
try:
    # Buscar el modelo en diferentes rutas
    model_paths = [
        "model/modeloV3.keras",
        "api/model/modeloV3.keras",
        "../model/modeloV3.keras",
        "./modeloV3.keras"
    ]
    
    modelo = None
    for path in model_paths:
        if os.path.exists(path):
            logger.info(f"Cargando modelo desde: {path}")
            modelo = tf.keras.models.load_model(path)
            logger.info("✅ Modelo cargado correctamente")
            break
    
    if modelo is None:
        raise FileNotFoundError("No se encontró el modelo en ninguna ruta")
        
except Exception as e:
    logger.error(f"❌ Error cargando el modelo: {e}")
    modelo = None

nombre_clases = [str(i) for i in range(10)]
logger.info(f"Clases: {nombre_clases}")

# Ruta raíz
@app.get("/")
def root():
    return {
        "message": "Modelo de IA, listo y funcionando",
        "version": "Versión 1.0",
        "autor": "Katia Paola Victoria Escalera"
    }

# Ruta de predicción
@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if modelo is None:
        raise HTTPException(status_code=500, detail="Modelo no cargado")
    
    try:
        # Leer la imagen
        contents = await file.read()
        logger.info(f"📸 Imagen recibida: {file.filename}, tamaño: {len(contents)} bytes")
        
        # Abrir y convertir a escala de grises
        image = Image.open(io.BytesIO(contents)).convert("L")
        
        # Redimensionar a 28x28
        image = image.resize((28, 28))
        
        # Convertir a array y normalizar
        image_array = np.array(image, dtype=np.float32) / 255.0
        
        # Invertir colores (MNIST espera fondo negro)
        image_array = 1.0 - image_array
        
        # Añadir dimensiones
        image_array = np.expand_dims(image_array, axis=-1)
        image_array = np.expand_dims(image_array, axis=0)
        
        # Predicción
        predicciones = modelo.predict(image_array, verbose=0)
        clase_idx = int(np.argmax(predicciones[0]))
        probabilidad = float(np.max(predicciones[0]))
        
        logger.info(f"✅ Predicción: dígito {clase_idx} con {probabilidad:.4f}")
        
        return {
            "clase": str(clase_idx),
            "probabilidad": probabilidad,
            "todas_probabilidades": predicciones[0].tolist()
        }
        
    except Exception as e:
        logger.error(f"❌ Error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

# Ruta para verificar estado
@app.get("/health")
def health():
    return {
        "status": "healthy" if modelo is not None else "unhealthy",
        "model_loaded": modelo is not None
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)