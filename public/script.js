// Aseguramos que XLSX esté disponible globalmente
var XLSX = window.XLSX

// Variables globales para almacenar los datos
var globalData = []
var fechaDesde, fechaHasta

// Añade esta variable global al principio del archivo
var summaryData = {}

document.getElementById("loadDataBtn").addEventListener("click", () => {
  var fileInput = document.getElementById("upload")
  var file = fileInput.files[0]

  if (!file) {
    alert("Por favor, selecciona un archivo.")
    return
  }

  var reader = new FileReader()

  reader.onload = (e) => {
    var data = e.target.result
    var workbook = XLSX.read(data, { type: "binary" })

    // Obtenemos la primera hoja del archivo Excel
    var sheet = workbook.Sheets[workbook.SheetNames[0]]

    // Convertimos la hoja en JSON
    globalData = XLSX.utils.sheet_to_json(sheet, { header: 1 })

    // Mostramos el filtro de fechas
    document.getElementById("filtroFechas").style.display = "block"

    // Establecemos las fechas mínima y máxima en los inputs de fecha
    setMinMaxDates()

    // Aplicamos el filtro inicial
    applyFilter()
  }

  reader.readAsBinaryString(file)
})

function setMinMaxDates() {
  var dates = globalData.slice(1).map((row) => {
    // Convertir la fecha de Excel a un objeto Date de JavaScript
    return new Date((row[1] - 25569) * 86400 * 1000)
  })
  var minDate = new Date(Math.min.apply(null, dates))
  var maxDate = new Date(Math.max.apply(null, dates))

  // Asegurarse de que la fecha máxima no exceda el 31 de diciembre de 2030
  var maxAllowedDate = new Date("2030-12-31")
  maxDate = maxDate > maxAllowedDate ? maxAllowedDate : maxDate

  var fechaDesdeInput = document.getElementById("fechaDesde")
  var fechaHastaInput = document.getElementById("fechaHasta")

  // Formatear las fechas para el atributo min y max de los inputs
  var minDateString = minDate.toISOString().split("T")[0]
  var maxDateString = maxDate.toISOString().split("T")[0]

  fechaDesdeInput.min = minDateString
  fechaDesdeInput.max = maxDateString
  fechaHastaInput.min = minDateString
  fechaHastaInput.max = maxDateString

  // Establecer valores iniciales
  fechaDesdeInput.value = minDateString
  fechaHastaInput.value = maxDateString

  // Actualizar el filtro global
  fechaDesde = minDate
  fechaHasta = maxDate
}

document.getElementById("aplicarFiltro").addEventListener("click", applyFilter)

function applyFilter() {
  fechaDesde = new Date(document.getElementById("fechaDesde").value)
  fechaHasta = new Date(document.getElementById("fechaHasta").value)

  // Asegurarse de que fechaHasta incluya todo el día seleccionado
  fechaHasta.setHours(23, 59, 59, 999)

  // Aplicamos el filtro a todas las funciones
  calculatePortfolioBalance(globalData)
  generateSummaryByTicker(globalData)
  generateSummaryByConcept(globalData)
  calculateDiferenciaCambio(globalData)
  generateSummaryByType(globalData)
  generateSalesResumeByTicker(globalData)
  fillTable(globalData)
}

function fillTable(data) {
  var tableBody = document.getElementById("tableBody")
  tableBody.innerHTML = "" // Limpiamos la tabla antes de llenarla

  // Recorremos los datos y los insertamos en la tabla
  for (var i = 1; i < data.length; i++) {
    var row = data[i]
    var fecha = new Date((row[1] - 25569) * 86400 * 1000) // Convertir la fecha de Excel
    if (fecha < fechaDesde || fecha > fechaHasta) continue

    var tr = document.createElement("tr")
    tr.className = i % 2 === 0 ? "bg-gray-50" : "bg-white"

    // Ahora las columnas están en el orden solicitado:
    var columns = [
      formatInteger(row[0]), // ID
      formatDate(fecha), // FECHA
      row[5] || "", // TIPO
      row[2] || "", // CONCEPTO
      row[11] || "", // TICKER
      formatNumber(row[12]), // CANTIDAD
      formatNumber(row[7]), // PRECIO UNITARIO
      formatNumber(row[8]), // PRECIO UNITARIO PESOS
      formatNumber(row[3]), // MONTO USD
      formatNumber(row[4]), // TC
      formatNumber(row[6]), // MONTO PESOS
      formatNumber(row[13]), // COSTO FIFO DIF CAMBIO
      formatNumber(row[14]), // DIFERENCIA CAMBIO
      formatNumber(row[16]), // RESULTADO VTA USD
      formatNumber(row[15]), // RESULTADO TOTAL VTA PESOS
      formatNumber(row[9]), // RDO VTA PESOS
      formatNumber(row[10]), // DIF DE CAMBIO VTA
    ]

    columns.forEach((value) => {
      var td = document.createElement("td")
      td.className = "px-6 py-4 whitespace-nowrap text-sm text-gray-500"
      td.textContent = value
      tr.appendChild(td)
    })

    tableBody.appendChild(tr)
  }
}

function calculatePortfolioBalance(data) {
  let saldoDolares = 0
  let saldoPesos = 0
  for (let i = 1; i < data.length; i++) {
    var fecha = new Date((data[i][1] - 25569) * 86400 * 1000)
    if (fecha < fechaDesde || fecha > fechaHasta) continue
    saldoDolares += Number.parseFloat(data[i][3]) || 0 // Columna MONTO USD
    saldoPesos += Number.parseFloat(data[i][6]) || 0 // Columna MONTO PESOS
  }

  document.getElementById("saldoDolares").textContent = formatNumber(saldoDolares)
  document.getElementById("saldoPesos").textContent = formatNumber(saldoPesos)

  // Calcula y establece el TC Actual inicial
  if (saldoDolares !== 0) {
    const tcActualInicial = saldoPesos / saldoDolares
    document.getElementById("tcActual").value = tcActualInicial.toFixed(2)
  }

  // Calcula y muestra el SALDO ACTUAL PESOS inicial
  updateSaldoActualPesos()
}

// Reemplaza la función generateSummaryByTicker completa con esta versión actualizada
function generateSummaryByTicker(data) {
  summaryData = {}

  var summary = {}

  // Recorremos los datos para generar el resumen
  for (var i = 1; i < data.length; i++) {
    var row = data[i]
    var fecha = new Date((row[1] - 25569) * 86400 * 1000)
    if (fecha < fechaDesde || fecha > fechaHasta) continue

    var ticker = row[11]
    if (!ticker) continue // Si no tiene ticker, lo saltamos
    var concepto = row[2] || ""
    var cantidad = Number.parseFloat(row[12]) || 0
    var montoPesos = Number.parseFloat(row[6]) || 0
    var resultadoTotalVtaPesos = Number.parseFloat(row[15]) || 0

    if (!summary[ticker]) {
      summary[ticker] = {
        cantidad: 0,
        precioUnitario: 0,
        precioUnitarioPesos: 0,
        montoUSD: 0,
        tc: 0,
        montoPesos: 0,
        valorUnitarioActual: 0,
        valuacionUSD: 0,
        valuacionPesos: 0,
      }
    }

    // Sumamos o restamos la cantidad según el concepto
    if (concepto.toLowerCase().includes("compra")) {
      summary[ticker].cantidad += cantidad
      summary[ticker].montoUSD -= Number.parseFloat(row[3]) || 0 // Restamos las compras en USD
      summary[ticker].montoPesos -= montoPesos // Restamos las compras en pesos
    } else if (concepto.toLowerCase().includes("venta")) {
      summary[ticker].cantidad -= cantidad
      summary[ticker].montoUSD -= Number.parseFloat(row[3]) || 0 // Restamos las ventas en USD
      summary[ticker].montoPesos -= montoPesos // Restamos las ventas en pesos
    }
    summary[ticker].montoUSD += Number.parseFloat(row[16]) || 0 // Sumamos el resultado de venta USD
    summary[ticker].montoPesos += resultadoTotalVtaPesos // Sumamos el resultado total de venta en pesos

    // Calculamos el TC como Monto Pesos / Monto USD
    if (summary[ticker].montoUSD !== 0) {
      summary[ticker].tc = summary[ticker].montoPesos / summary[ticker].montoUSD
    } else {
      summary[ticker].tc = 0
    }

    // Calculamos el precio unitario como Monto USD / Cantidad
    if (summary[ticker].cantidad !== 0) {
      summary[ticker].precioUnitario = summary[ticker].montoUSD / summary[ticker].cantidad
    } else {
      summary[ticker].precioUnitario = 0
    }

    // Calculamos el precio unitario en pesos como Monto Pesos / Cantidad
    if (summary[ticker].cantidad !== 0) {
      summary[ticker].precioUnitarioPesos = summary[ticker].montoPesos / summary[ticker].cantidad
    } else {
      summary[ticker].precioUnitarioPesos = 0
    }
  }

  // Convertimos el objeto summary en un array para poder ordenarlo
  var summaryArray = Object.entries(summary).map(([ticker, data]) => ({ ticker, ...data }))

  // Ordenamos el array de mayor a menor según la cantidad
  summaryArray.sort((a, b) => Math.abs(b.cantidad) - Math.abs(a.cantidad))

  // Llenamos la tabla de resumen
  var resumenBody = document.getElementById("resumenBody")
  resumenBody.innerHTML = "" // Limpiamos la tabla antes de llenarla

  // Luego, agregamos las filas normales
  summaryArray.forEach((item, index) => {
    var tr = document.createElement("tr")
    tr.className = index % 2 === 0 ? "bg-white" : "bg-gray-50"

    var columns = [
      item.ticker,
      formatNumber(item.cantidad),
      formatNumber(item.precioUnitario),
      formatNumber(item.precioUnitarioPesos),
      formatNumber(item.montoUSD),
      formatNumber(item.tc),
      formatNumber(item.montoPesos),
    ]

    columns.forEach((value, colIndex) => {
      var td = document.createElement("td")
      td.className = "px-6 py-4 whitespace-nowrap text-sm text-gray-500"
      td.textContent = value
      tr.appendChild(td)
    })

    // Columna VALOR UNITARIO ACTUAL
    var td8 = document.createElement("td")
    td8.className = "px-6 py-4 whitespace-nowrap text-sm text-gray-500"
    var input = document.createElement("input")
    input.type = "number"
    input.className =
      "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
    input.step = "0.01"
    input.min = "0"
    input.value = item.valorUnitarioActual.toFixed(2)
    input.dataset.ticker = item.ticker
    input.dataset.cantidad = item.cantidad
    input.addEventListener("input", function () {
      updateValuacion(this.dataset.ticker, this.dataset.cantidad, this.value)
    })
    td8.appendChild(input)
    tr.appendChild(td8)

    // Columna VALUACION USD
    var td9 = document.createElement("td")
    td9.className = "px-6 py-4 whitespace-nowrap text-sm text-gray-500 valuacion-usd"
    td9.textContent = formatNumber(item.valuacionUSD)
    tr.appendChild(td9)

    // Nueva columna VALUACION PESOS
    var td10 = document.createElement("td")
    td10.className = "px-6 py-4 whitespace-nowrap text-sm text-gray-500 valuacion-pesos"
    td10.textContent = formatNumber(item.valuacionPesos)
    tr.appendChild(td10)

    resumenBody.appendChild(tr)

    // Guarda los datos en summaryData
    summaryData[item.ticker] = {
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
      precioUnitarioPesos: item.precioUnitarioPesos,
      montoUSD: item.montoUSD,
      tc: item.tc,
      montoPesos: item.montoPesos,
      valorUnitarioActual: item.valorUnitarioActual,
      valuacionUSD: item.valuacionUSD,
      valuacionPesos: item.valuacionPesos,
    }
  })

  // Después de llenar la tabla de resumen, agregamos la fila de totales
  var totals = {
    cantidad: 0,
    precioUnitario: 0,
    precioUnitarioPesos: 0,
    montoUSD: 0,
    tc: 0,
    montoPesos: 0,
    valorUnitarioActual: 0, // Agregamos esta línea
    valuacionUSD: 0,
    valuacionPesos: 0,
  }

  for (var item of summaryArray) {
    totals.cantidad += item.cantidad
    totals.montoUSD += item.montoUSD
    totals.montoPesos += item.montoPesos
    totals.valuacionUSD += item.valuacionUSD
    totals.valuacionPesos += item.valuacionPesos
  }

  // Calculamos los promedios para precio unitario, precio unitario pesos y tc
  if (summaryArray.length > 0) {
    totals.precioUnitario = totals.montoUSD / totals.cantidad
    totals.precioUnitarioPesos = totals.montoPesos / totals.cantidad
    totals.tc = totals.montoPesos / totals.montoUSD
    totals.valorUnitarioActual = totals.valuacionUSD / totals.cantidad // Agregamos esta línea
  }

  var trTotal = document.createElement("tr")

  trTotal.classList.add("bg-gray-100", "font-semibold")

  var tdTotal = document.createElement("td")
  tdTotal.textContent = "TOTAL"
  tdTotal.className = "px-6 py-4 whitespace-nowrap text-sm text-gray-900"
  trTotal.appendChild(tdTotal)

  for (var key in totals) {
    var td = document.createElement("td")
    td.textContent = formatNumber(totals[key])
    td.className = "px-6 py-4 whitespace-nowrap text-sm text-gray-900"
    if (key === "valuacionUSD") {
      td.id = "totalValuacionUSD"
    } else if (key === "valuacionPesos") {
      td.id = "totalValuacionPesos"
    } else if (key === "valorUnitarioActual") {
      td.id = "totalValorUnitarioActual"
    }
    trTotal.appendChild(td)
  }

  resumenBody.appendChild(trTotal)
}

function handleTCActualChange() {
  const tcActualInput = document.getElementById("tcActual")
  tcActualInput.addEventListener("change", (event) => {
    const tcActual = Number.parseFloat(event.target.value)
    if (!isNaN(tcActual) && tcActual > 0) {
      updateSaldoActualPesos()
      updateAllValuations(tcActual)
    } else {
      alert("Por favor, ingrese un valor numérico válido para TC Actual.")
      event.target.value = ""
    }
  })
}

function updateAllValuations(tcActual) {
  const rows = document.querySelectorAll("#resumenBody tr:not(:last-child)")
  rows.forEach((row) => {
    const ticker = row.querySelector("td:first-child").textContent
    const cantidad = Number.parseFloat(row.querySelector("td:nth-child(2)").textContent.replace(/,/g, ""))
    const valorUnitarioActualInput = row.querySelector("input[type='number']")
    const valorUnitarioActual = Number.parseFloat(valorUnitarioActualInput.value)

    if (!isNaN(cantidad) && !isNaN(valorUnitarioActual)) {
      updateValuacion(ticker, cantidad, valorUnitarioActual, tcActual)
    }
  })
}

// Actualiza la función updateValuacion para aceptar tcActual como parámetro
function updateValuacion(ticker, cantidad, valorUnitarioActual, tcActual) {
  // Buscar todas las filas en resumenBody
  const rows = document.querySelectorAll("#resumenBody tr")
  let row = null

  // Recorrer las filas para encontrar la que coincide con el ticker
  for (let i = 0; i < rows.length; i++) {
    const firstCell = rows[i].querySelector("td:first-child")
    if (firstCell && firstCell.textContent === ticker) {
      row = rows[i]
      break
    }
  }

  if (!row) return

  cantidad = Number.parseFloat(cantidad)
  valorUnitarioActual = Number.parseFloat(valorUnitarioActual)

  if (!isNaN(cantidad) && !isNaN(valorUnitarioActual)) {
    const valuacionUSD = cantidad * valorUnitarioActual
    if (tcActual === undefined) {
      tcActual = Number.parseFloat(document.getElementById("tcActual").value) || 0
    }
    const valuacionPesos = valuacionUSD * tcActual

    // Actualizar la celda de valuación USD en la fila encontrada
    const valuacionUSDCell = row.querySelector(".valuacion-usd")
    if (valuacionUSDCell) {
      valuacionUSDCell.textContent = formatNumber(valuacionUSD)
    }

    // Actualizar la celda de valuación Pesos en la fila encontrada
    const valuacionPesosCell = row.querySelector(".valuacion-pesos")
    if (valuacionPesosCell) {
      valuacionPesosCell.textContent = formatNumber(valuacionPesos)
    }

    // Actualizar summaryData
    if (summaryData[ticker]) {
      summaryData[ticker].valorUnitarioActual = valorUnitarioActual
      summaryData[ticker].valuacionUSD = valuacionUSD
      summaryData[ticker].valuacionPesos = valuacionPesos
    }

    // Actualizar el total de valuación
    updateTotalValuacion()
  }
}

function updateTotalValuacion() {
  let totalValuacionUSD = 0
  let totalValuacionPesos = 0

  const valuacionesUSD = document.querySelectorAll(".valuacion-usd")
  const valuacionesPesos = document.querySelectorAll(".valuacion-pesos")

  valuacionesUSD.forEach((el) => {
    if (el.textContent) {
      // Quitar comas y convertir a número
      totalValuacionUSD += Number.parseFloat(el.textContent.replace(/,/g, "")) || 0
    }
  })

  valuacionesPesos.forEach((el) => {
    if (el.textContent) {
      // Quitar comas y convertir a número
      totalValuacionPesos += Number.parseFloat(el.textContent.replace(/,/g, "")) || 0
    }
  })

  const totalRow = document.querySelector("#resumenBody tr:last-child")
  if (totalRow) {
    const totalValuacionUSDCell = totalRow.querySelector("#totalValuacionUSD")
    if (totalValuacionUSDCell) {
      totalValuacionUSDCell.textContent = formatNumber(totalValuacionUSD)
    }

    const totalValuacionPesosCell = totalRow.querySelector("#totalValuacionPesos")
    if (totalValuacionPesosCell) {
      totalValuacionPesosCell.textContent = formatNumber(totalValuacionPesos)
    }
  }
}

function generateSummaryByConcept(data) {
  var summary = {}

  // Recorremos los datos para generar el resumen
  for (var i = 1; i < data.length; i++) {
    var row = data[i]
    var fecha = new Date((row[1] - 25569) * 86400 * 1000) // Convertir la fecha de Excel
    if (fecha < fechaDesde || fecha > fechaHasta) continue

    var concepto = row[2] || "Sin concepto"
    var montoUSD = Number.parseFloat(row[3]) || 0
    var montoPesos = Number.parseFloat(row[6]) || 0

    if (!summary[concepto]) {
      summary[concepto] = {
        montoUSD: 0,
        montoPesos: 0,
      }
    }

    summary[concepto].montoUSD += montoUSD
    summary[concepto].montoPesos += montoPesos
  }

  // Convertimos el objeto summary en un array para poder ordenarlo
  var summaryArray = Object.entries(summary).map(([concepto, data]) => ({ concepto, ...data }))

  // Ordenamos el array de mayor a menor según el monto USD
  summaryArray.sort((a, b) => Math.abs(b.montoUSD) - Math.abs(a.montoUSD))

  // Llenamos la tabla de resumen por concepto
  var resumenConceptoBody = document.getElementById("resumenConceptoBody")
  resumenConceptoBody.innerHTML = "" // Limpiamos la tabla antes de llenarla

  summaryArray.forEach((item, index) => {
    var tr = document.createElement("tr")
    tr.className = index % 2 === 0 ? "bg-white" : "bg-gray-50"

    var td1 = document.createElement("td")
    td1.textContent = item.concepto
    td1.className = "px-6 py-4 whitespace-nowrap text-sm text-gray-500"
    tr.appendChild(td1)

    var td2 = document.createElement("td")
    td2.textContent = formatNumber(item.montoUSD)
    td2.className = "px-6 py-4 whitespace-nowrap text-sm text-gray-500"
    tr.appendChild(td2)

    var td3 = document.createElement("td")
    td3.textContent = formatNumber(item.montoPesos)
    td3.className = "px-6 py-4 whitespace-nowrap text-sm text-gray-500"
    tr.appendChild(td3)

    resumenConceptoBody.appendChild(tr)
  })

  // Después de llenar la tabla de resumen por concepto, agregamos la fila de totales
  var totals = {
    montoUSD: 0,
    montoPesos: 0,
  }

  for (var item of summaryArray) {
    totals.montoUSD += item.montoUSD
    totals.montoPesos += item.montoPesos
  }

  var trTotal = document.createElement("tr")
  trTotal.classList.add("bg-gray-100", "font-semibold")

  var tdTotal = document.createElement("td")
  tdTotal.textContent = "TOTAL"
  tdTotal.className = "px-6 py-4 whitespace-nowrap text-sm text-gray-900"
  trTotal.appendChild(tdTotal)

  for (var key in totals) {
    var td = document.createElement("td")
    td.textContent = formatNumber(totals[key])
    td.className = "px-6 py-4 whitespace-nowrap text-sm text-gray-900"
    trTotal.appendChild(td)
  }

  resumenConceptoBody.appendChild(trTotal)
}

function calculateDiferenciaCambio(data) {
  let diferenciaCambio = 0
  for (let i = 1; i < data.length; i++) {
    var fecha = new Date((data[i][1] - 25569) * 86400 * 1000) // Convertir la fecha de Excel
    if (fecha < fechaDesde || fecha > fechaHasta) continue
    diferenciaCambio += Number.parseFloat(data[i][14]) || 0 // Columna DIFERENCIA CAMBIO
  }

  document.getElementById("diferenciaCambioTotal").textContent = formatNumber(diferenciaCambio)
}

function generateSummaryByType(data) {
  var summary = {}

  // Recorremos los datos para generar el resumen
  for (var i = 1; i < data.length; i++) {
    var row = data[i]
    var fecha = new Date((row[1] - 25569) * 86400 * 1000) // Convertir la fecha de Excel
    if (fecha < fechaDesde || fecha > fechaHasta) continue

    var tipo = row[5] || "Sin tipo"
    var montoUSD = Number.parseFloat(row[3]) || 0
    var montoPesos = Number.parseFloat(row[6]) || 0

    if (!summary[tipo]) {
      summary[tipo] = {
        montoUSD: 0,
        montoPesos: 0,
      }
    }

    summary[tipo].montoUSD += montoUSD
    summary[tipo].montoPesos += montoPesos
  }

  // Convertimos el objeto summary en un array para poder ordenarlo
  var summaryArray = Object.entries(summary).map(([tipo, data]) => ({ tipo, ...data }))

  // Ordenamos el array de mayor a menor según el monto USD
  summaryArray.sort((a, b) => Math.abs(b.montoUSD) - Math.abs(a.montoUSD))

  // Llenamos la tabla de resumen por tipo
  var resumenTipoBody = document.getElementById("resumenTipoBody")
  resumenTipoBody.innerHTML = "" // Limpiamos la tabla antes de llenarla

  summaryArray.forEach((item, index) => {
    var tr = document.createElement("tr")
    tr.className = index % 2 === 0 ? "bg-white" : "bg-gray-50"

    var td1 = document.createElement("td")
    td1.textContent = item.tipo
    td1.className = "px-6 py-4 whitespace-nowrap text-sm text-gray-500"
    tr.appendChild(td1)
    var td2 = document.createElement("td")
    td2.textContent = formatNumber(item.montoUSD)
    td2.className = "px-6 py-4 whitespace-nowrap text-sm text-gray-500"
    tr.appendChild(td2)
    var td3 = document.createElement("td")
    td3.textContent = formatNumber(item.montoPesos)
    td3.className = "px-6 py-4 whitespace-nowrap text-sm text-gray-500"
    tr.appendChild(td3)

    resumenTipoBody.appendChild(tr)
  })

  // Después de llenar la tabla de resumen por tipo, agregamos la fila de totales
  var totals = {
    montoUSD: 0,
    montoPesos: 0,
  }

  for (var item of summaryArray) {
    totals.montoUSD += item.montoUSD
    totals.montoPesos += item.montoPesos
  }

  var trTotal = document.createElement("tr")
  trTotal.classList.add("bg-gray-100", "font-semibold")

  var tdTotal = document.createElement("td")
  tdTotal.textContent = "TOTAL"
  tdTotal.className = "px-6 py-4 whitespace-nowrap text-sm text-gray-900"
  trTotal.appendChild(tdTotal)

  for (var key in totals) {
    var td = document.createElement("td")
    td.textContent = formatNumber(totals[key])
    td.className = "px-6 py-4 whitespace-nowrap text-sm text-gray-900"
    trTotal.appendChild(td)
  }

  resumenTipoBody.appendChild(trTotal)
}

function generateSalesResumeByTicker(data) {
  var summary = {}

  // Recorremos los datos para generar el resumen de ventas
  for (var i = 1; i < data.length; i++) {
    var row = data[i]
    var fecha = new Date((row[1] - 25569) * 86400 * 1000) // Convertir la fecha de Excel
    if (fecha < fechaDesde || fecha > fechaHasta) continue

    var ticker = row[11]
    var concepto = row[2] || ""

    // Solo consideramos las ventas
    if (!concepto.toLowerCase().includes("venta")) continue

    if (!ticker) continue // Si no tiene ticker, lo saltamos

    if (!summary[ticker]) {
      summary[ticker] = {
        resultadoVtaUSD: 0,
        resultadoTotalVtaPesos: 0,
        rdoVtaPesos: 0,
        difDeCambioVta: 0,
      }
    }

    summary[ticker].resultadoVtaUSD += Number.parseFloat(row[16]) || 0
    summary[ticker].resultadoTotalVtaPesos += Number.parseFloat(row[15]) || 0
    summary[ticker].rdoVtaPesos += Number.parseFloat(row[9]) || 0
    summary[ticker].difDeCambioVta += Number.parseFloat(row[10]) || 0
  }

  // Convertimos el objeto summary en un array para poder ordenarlo
  var summaryArray = Object.entries(summary).map(([ticker, data]) => ({ ticker, ...data }))

  // Ordenamos el array de mayor a menor según el resultado de venta USD
  summaryArray.sort((a, b) => Math.abs(b.resultadoVtaUSD) - Math.abs(a.resultadoVtaUSD))

  // Llenamos la tabla de resumen de ventas
  var resumenVentasBody = document.getElementById("resumenVentasBody")
  resumenVentasBody.innerHTML = "" // Limpiamos la tabla antes de llenarla

  summaryArray.forEach((item, index) => {
    var tr = document.createElement("tr")
    tr.className = index % 2 === 0 ? "bg-white" : "bg-gray-50"

    var td1 = document.createElement("td")
    td1.textContent = item.ticker
    td1.className = "px-6 py-4 whitespace-nowrap text-sm text-gray-500"
    tr.appendChild(td1)
    var td2 = document.createElement("td")
    td2.textContent = formatNumber(item.resultadoVtaUSD)
    td2.className = "px-6 py-4 whitespace-nowrap text-sm text-gray-500"
    tr.appendChild(td2)
    var td3 = document.createElement("td")
    td3.textContent = formatNumber(item.resultadoTotalVtaPesos)
    td3.className = "px-6 py-4 whitespace-nowrap text-sm text-gray-500"
    tr.appendChild(td3)
    var td4 = document.createElement("td")
    td4.textContent = formatNumber(item.rdoVtaPesos)
    td4.className = "px-6 py-4 whitespace-nowrap text-sm text-gray-500"
    tr.appendChild(td4)
    var td5 = document.createElement("td")
    td5.textContent = formatNumber(item.difDeCambioVta)
    td5.className = "px-6 py-4 whitespace-nowrap text-sm text-gray-500"
    tr.appendChild(td5)

    resumenVentasBody.appendChild(tr)
  })

  // Después de llenar la tabla de resumen de ventas, agregamos la fila de totales
  var totals = {
    resultadoVtaUSD: 0,
    resultadoTotalVtaPesos: 0,
    rdoVtaPesos: 0,
    difDeCambioVta: 0,
  }

  for (var item of summaryArray) {
    totals.resultadoVtaUSD += item.resultadoVtaUSD
    totals.resultadoTotalVtaPesos += item.resultadoTotalVtaPesos
    totals.rdoVtaPesos += item.rdoVtaPesos
    totals.difDeCambioVta += item.difDeCambioVta
  }

  var trTotal = document.createElement("tr")
  trTotal.classList.add("bg-gray-100", "font-semibold")

  var tdTotal = document.createElement("td")
  tdTotal.textContent = "TOTAL"
  tdTotal.className = "px-6 py-4 whitespace-nowrap text-sm text-gray-900"
  trTotal.appendChild(tdTotal)

  for (var key in totals) {
    var td = document.createElement("td")
    td.textContent = formatNumber(totals[key])
    td.className = "px-6 py-4 whitespace-nowrap text-sm text-gray-900"
    trTotal.appendChild(td)
  }

  resumenVentasBody.appendChild(trTotal)
}

function formatInteger(value) {
  // Si el valor es un número válido, lo redondeamos a entero
  return value !== undefined && value !== null && !isNaN(value) ? Math.round(value) : ""
}

function formatDate(date) {
  // Asegurarse de que date sea un objeto Date válido
  if (!(date instanceof Date) || isNaN(date)) {
    return "Fecha inválida"
  }
  // Formato de fecha en español (día/mes/año)
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function formatNumber(value) {
  // Verificamos si el valor es un número válido
  if (value !== undefined && value !== null && !isNaN(value)) {
    if (value === 0 || value === "") {
      return "" // Si el valor es 0 o vacío, mostramos vacío
    }
    return Number.parseFloat(value).toFixed(1) // Redondeamos a un decimal
  }
  return "" // Si no es un número válido o es NaN, devolvemos vacío
}

function handleTCActualChange() {
  const tcActualInput = document.getElementById("tcActual")
  tcActualInput.addEventListener("change", (event) => {
    const tcActual = Number.parseFloat(event.target.value)
    if (!isNaN(tcActual) && tcActual > 0) {
      updateSaldoActualPesos()
      updateAllValuations(tcActual)
    } else {
      alert("Por favor, ingrese un valor numérico válido para TC Actual.")
      event.target.value = ""
    }
  })
}

function updateSaldoActualPesos() {
  const saldoDolares = Number.parseFloat(document.getElementById("saldoDolares").textContent.replace(",", ""))
  const tcActual = Number.parseFloat(document.getElementById("tcActual").value)
  if (!isNaN(saldoDolares) && !isNaN(tcActual)) {
    const saldoActualPesos = saldoDolares * tcActual
    document.getElementById("saldoActualPesos").textContent = formatNumber(saldoActualPesos)
  }
}

// Llama a esta función al cargar la página
document.addEventListener("DOMContentLoaded", () => {
  handleTCActualChange()
  updateSaldoActualPesos()
})

// Modifica la función exportToExcel
function exportToExcel() {
  // Crear un nuevo libro de trabajo
  var wb = XLSX.utils.book_new()

  // Exportar la tabla de resumen por ticker
  var ws1 = XLSX.utils.table_to_sheet(document.getElementById("resumenTable"))

  // Modificar los datos de la hoja para incluir el valor unitario actual
  var range = XLSX.utils.decode_range(ws1["!ref"])
  for (var R = range.s.r + 1; R <= range.e.r; ++R) {
    var ticker = ws1[XLSX.utils.encode_cell({ r: R, c: 0 })].v
    if (summaryData[ticker]) {
      var valorUnitarioActualCell = XLSX.utils.encode_cell({ r: R, c: 7 })
      ws1[valorUnitarioActualCell] = { v: summaryData[ticker].valorUnitarioActual, t: "n" }

      // Agregar la columna de VALUACION PESOS
      var valuacionPesosCell = XLSX.utils.encode_cell({ r: R, c: 9 })
      ws1[valuacionPesosCell] = { v: summaryData[ticker].valuacionPesos, t: "n" }
    }
  }

  XLSX.utils.book_append_sheet(wb, ws1, "Resumen por Ticker")

  // Exportar la tabla de resumen por concepto
  var ws2 = XLSX.utils.table_to_sheet(document.getElementById("resumenConceptoTable"))
  XLSX.utils.book_append_sheet(wb, ws2, "Resumen por Concepto")

  // Exportar la tabla de resumen por tipo
  var ws3 = XLSX.utils.table_to_sheet(document.getElementById("resumenTipoTable"))
  XLSX.utils.book_append_sheet(wb, ws3, "Resumen por Tipo")

  // Exportar la tabla de resumen de ventas
  var ws4 = XLSX.utils.table_to_sheet(document.getElementById("resumenVentasTable"))
  XLSX.utils.book_append_sheet(wb, ws4, "Resumen de Ventas")

  // Exportar la tabla principal de datos
  var ws5 = XLSX.utils.table_to_sheet(document.getElementById("dataTable"))
  XLSX.utils.book_append_sheet(wb, ws5, "Datos Completos")

  // Guardar el archivo
  XLSX.writeFile(wb, "resumen_financiero.xlsx")
}

// Agregar el evento click al botón de exportación
document.addEventListener("DOMContentLoaded", () => {
  var exportButton = document.createElement("button")
  exportButton.textContent = "Exportar a Excel"
  exportButton.className =
    "ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
  exportButton.addEventListener("click", exportToExcel)

  // Insertar el botón después del botón "Cargar Datos"
  var loadDataBtn = document.getElementById("loadDataBtn")
  if (loadDataBtn && loadDataBtn.parentNode) {
    loadDataBtn.parentNode.insertBefore(exportButton, loadDataBtn.nextSibling)
  }
})

