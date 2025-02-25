// scripts/fifopipeline.js
import xlsx from 'xlsx';
import path from 'path';

export async function procesarFIFO(inputFilePath) {
  try {
    // Lee el archivo de entrada
    const workbook = xlsx.readFile(inputFilePath);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // Etapa 1: Ordenar por ID
    data.sort((a, b) => a.ID - b.ID);

    // Etapa 2: Calcular columnas iniciales
    data.forEach(row => {
      row.TIPO = row["MONTO USD"] > 0 ? "INGRESO" : "EGRESO";
      row["MONTO PESOS"] = row["TC"] * row["MONTO USD"];
      row["PRECIO UNITARIO"] = row["CANTIDAD"] > 0 && row["TIPO"] === "EGRESO" 
        ? -row["MONTO USD"] / row["CANTIDAD"] 
        : row["CANTIDAD"] > 0 && row["TIPO"] === "INGRESO" 
        ? row["MONTO USD"] / row["CANTIDAD"] 
        : "";
      row["PRECIO UNITARIO PESOS"] = row["CANTIDAD"] > 0 && row["TIPO"] === "EGRESO" 
        ? -row["MONTO PESOS"] / row["CANTIDAD"] 
        : row["CANTIDAD"] > 0 && row["TIPO"] === "INGRESO" 
        ? row["MONTO PESOS"] / row["CANTIDAD"] 
        : "";
    });

    // Etapa 3: Lógica FIFO global
    let ingresos = [];
    data.forEach(row => {
      if (row.TIPO === "INGRESO") {
        ingresos.push({ ...row, PENDIENTE: row["MONTO USD"] });
      } else if (row.TIPO === "EGRESO") {
        let cantidadNecesaria = Math.abs(row["MONTO USD"]);
        let costoEnPesosFIFO = 0;

        while (cantidadNecesaria > 0 && ingresos.length > 0) {
          const ingreso = ingresos[0];
          const disponible = ingreso.PENDIENTE;

          if (disponible <= cantidadNecesaria) {
            costoEnPesosFIFO += disponible * ingreso["TC"];
            cantidadNecesaria -= disponible;
            ingreso.PENDIENTE = 0;
            ingresos.shift();
          } else {
            costoEnPesosFIFO += cantidadNecesaria * ingreso["TC"];
            ingreso.PENDIENTE -= cantidadNecesaria;
            cantidadNecesaria = 0;
          }
        }

        row["COSTO FIFO DIF CAMBIO"] = costoEnPesosFIFO;
        row["DIFERENCIA CAMBIO"] = -row["MONTO PESOS"] - costoEnPesosFIFO;
      }
    });

    // Etapa 4: Lógica FIFO para CONCEPTO y cálculo de RESULTADO VTA USD por TICKER
    let tickers = [...new Set(data.map(row => row.TICKER))];

    tickers.forEach(ticker => {
      let compras = [];

      data.forEach(row => {
        if (row.TICKER === ticker) {
          if (row.CONCEPTO === "COMPRA") {
            compras.push({ ...row, PENDIENTE: row["CANTIDAD"] });
          } else if (row.CONCEPTO === "VENTA" || row.CONCEPTO === "AMORTIZACIÓN") {
            let cantidadNecesaria = Math.abs(row["CANTIDAD"]);
            let costoEnDolaresFIFO = 0;

            while (cantidadNecesaria > 0 && compras.length > 0) {
              const compra = compras[0];
              const disponible = compra.PENDIENTE;

              if (disponible <= cantidadNecesaria) {
                costoEnDolaresFIFO += disponible * compra["PRECIO UNITARIO"];
                cantidadNecesaria -= disponible;
                compra.PENDIENTE = 0;
                compras.shift();
              } else {
                costoEnDolaresFIFO += cantidadNecesaria * compra["PRECIO UNITARIO"];
                compra.PENDIENTE -= cantidadNecesaria;
                cantidadNecesaria = 0;
              }
            }

            row["RESULTADO VTA USD"] = row["MONTO USD"] - costoEnDolaresFIFO;
          }
        }
      });

      // Etapa 5: Lógica FIFO para MONTO PESOS y cálculo de RESULTADO TOTAL VTA PESOS
      let comprasPesos = [];

      data.forEach(row => {
        if (row.TICKER === ticker) {
          if (row.CONCEPTO === "COMPRA") {
            comprasPesos.push({ ...row, PENDIENTE: row["CANTIDAD"] });
          } else if (row.CONCEPTO === "VENTA" || row.CONCEPTO === "AMORTIZACIÓN") {
            let cantidadNecesaria = Math.abs(row["CANTIDAD"]);
            let costoEnPesosFIFO = 0;

            while (cantidadNecesaria > 0 && comprasPesos.length > 0) {
              const compra = comprasPesos[0];
              const disponible = compra.PENDIENTE;

              if (disponible <= cantidadNecesaria) {
                costoEnPesosFIFO += disponible * compra["PRECIO UNITARIO PESOS"];
                cantidadNecesaria -= disponible;
                compra.PENDIENTE = 0;
                comprasPesos.shift();
              } else {
                costoEnPesosFIFO += cantidadNecesaria * compra["PRECIO UNITARIO PESOS"];
                compra.PENDIENTE -= cantidadNecesaria;
                cantidadNecesaria = 0;
              }
            }

            row["RESULTADO TOTAL VTA PESOS"] = row["MONTO PESOS"] - costoEnPesosFIFO;
          }
        }
      });
    });

    // Etapa 6: Calcular columnas finales de rdo pesos
    data.forEach(row => {
      row["RDO VTA PESOS"] = row["RESULTADO TOTAL VTA PESOS"] !== 0 
        && row["RESULTADO TOTAL VTA PESOS"] !== "" 
        && row["RESULTADO TOTAL VTA PESOS"] != null 
        ? row["MONTO PESOS"] - ((row["MONTO USD"] - row["RESULTADO VTA USD"]) * row["TC"]) 
        : "";

      row["DIF DE CAMBIO VTA"] = row["RESULTADO TOTAL VTA PESOS"] !== 0 
        && row["RESULTADO TOTAL VTA PESOS"] !== "" 
        && row["RESULTADO TOTAL VTA PESOS"] != null 
        ? row["RESULTADO TOTAL VTA PESOS"] - row["RDO VTA PESOS"] 
        : "";
    });

    // Escribir el archivo procesado
    const newSheet = xlsx.utils.json_to_sheet(data);
    const newWorkbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(newWorkbook, newSheet, sheetName);
    
    // Generar nombre único con timestamp
    const timestamp = new Date().getTime();
    const outputFileName = `processed_${timestamp}.xlsx`;
    const outputFilePath = path.join('./public/uploads', outputFileName);
    
    // Configurar opciones de escritura
    const writeOpts = {
      bookType: 'xlsx',
      bookSST: false,
      type: 'file'
    };
    
    xlsx.writeFile(newWorkbook, outputFilePath, writeOpts);

    return {
      success: true,
      message: 'Archivo procesado correctamente',
      outputPath: outputFilePath,
      outputFileName: outputFileName,
      data: data
    };
  } catch (error) {
    console.error('Error en procesamiento:', error);
    return {
      success: false,
      message: `Error en el procesamiento: ${error.message}`,
      error: error
    };
  }
}
