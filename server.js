const express = require("express");
const next = require("next");
const path = require("path");
const session = require("express-session");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

const server = express();
const PORT = 3000;

// Configurar sesión
server.use(
  session({
    secret: "clave-secreta", // Cámbiala por una clave segura
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Usa `true` si estás en HTTPS
  })
);

// Middleware para verificar sesión
const requireLogin = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/login.html");
  }
  next();
};

// Redirigir /Visu/index.html a /index.html
server.get("/Visu/index.html", (req, res) => {
  res.redirect("/index.html");
});

// Rutas de autenticación
server.use(express.json()); // Para procesar JSON en POST

server.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "prueba" && password === "12345") {
    req.session.user = username;
    return res.json({ success: true });
  }
  res.status(401).json({ success: false, message: "Credenciales incorrectas" });
});

server.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login.html");
  });
});

// Rutas protegidas
server.get("/index.html", requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

server.get("/upload_xlsx.html", requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "upload_xlsx.html"));
});

// Ruta de login (pública)
server.get(["/", "/login", "/login.html"], (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Archivos estáticos
server.use(express.static(path.join(__dirname, "public")));

app.prepare().then(() => {
  server.all("*", (req, res) => {
    return handle(req, res);
  });

  server.listen(PORT, () => {
    console.log(`🔥 Servidor corriendo en http://localhost:${PORT}`);
  });
});
