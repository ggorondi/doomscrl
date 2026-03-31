import type { NextPageContext } from "next";

function ErrorPage({ statusCode }: { statusCode?: number }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <div>
        <p style={{ fontSize: "0.85rem", color: "#555", marginBottom: "0.75rem" }}>
          {statusCode ? `Error ${statusCode}` : "Application error"}
        </p>
        <h1 style={{ fontSize: "2rem", margin: 0 }}>Something went wrong.</h1>
      </div>
    </main>
  );
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res?.statusCode ?? err?.statusCode ?? 500;
  return { statusCode };
};

export default ErrorPage;
