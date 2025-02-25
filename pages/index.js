import { useEffect } from "react";
import { useRouter } from "next/router";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // 🔥 Simulamos autenticación con localStorage (podés cambiar esto)
    const isAuthenticated = localStorage.getItem("loggedIn");

    if (!isAuthenticated) {
      // Si no está autenticado, lo mandamos a login.html
      window.location.href = "/login.html";
    }
  }, []);

  return (
    <div>
      <h1>Bienvenido a la Interfaz Next.js</h1>
      <p>Ya estás logueado.</p>
      <button
        onClick={() => {
          localStorage.removeItem("loggedIn");
          router.push("/login.html");
        }}
      >
        Cerrar sesión
      </button>
    </div>
  );
}
