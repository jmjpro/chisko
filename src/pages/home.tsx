import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import Header from "../components/header";
import Footer from "../components/footer";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const { t } = useTranslation("home");

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <img
          src="/mascotChiski.svg"
          alt="Chiski"
          className="w-40 h-40 mb-8 drop-shadow-md"
        />
        <h1 className="text-4xl font-extrabold tracking-tight mb-4 max-w-md">
          {t("hero_title")}
        </h1>
        <p className="text-lg text-muted-foreground mb-10 max-w-sm">
          {t("hero_subtitle")}
        </p>
        <div className="flex gap-4 flex-wrap justify-center">
          <Button asChild size="lg">
            <Link to="/wizard">{t("cta_wizard")}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/plans">{t("cta_plans")}</Link>
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
