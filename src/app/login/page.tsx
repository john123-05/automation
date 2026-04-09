import { redirect } from "next/navigation";
import { hasAppAccess, isAppAuthEnabled } from "@/lib/app-auth";
import { getUiSettings } from "@/lib/ui-settings";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const authEnabled = isAppAuthEnabled();

  if (!authEnabled) {
    redirect("/");
  }

  if (await hasAppAccess()) {
    redirect("/");
  }

  const { language } = await getUiSettings();
  const params = (searchParams ? await searchParams : undefined) ?? {};
  const next = readSearchParam(params.next);
  const hasError = readSearchParam(params.error) === "1";

  const copy =
    language === "de"
      ? {
          overline: "Sicherer Zugang",
          title: "Bei Fieldflow anmelden",
          description:
            "Diese gehostete App ist mit einem gemeinsamen Passwort geschützt, bevor du das Dashboard öffnen kannst.",
          password: "Passwort",
          submit: "Anmelden",
          error: "Das Passwort war leider nicht korrekt.",
        }
      : {
          overline: "Secure access",
          title: "Sign in to Fieldflow",
          description:
            "This hosted app is protected by a shared password before you can open the dashboard.",
          password: "Password",
          submit: "Sign in",
          error: "That password was not correct.",
        };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-10 sm:px-6">
      <section className="glass-panel w-full rounded-[34px] p-8">
        <p className="text-sm uppercase tracking-[0.18em] text-muted">{copy.overline}</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-950">{copy.title}</h1>
        <p className="mt-3 text-sm text-slate-600">{copy.description}</p>

        <form action="/api/auth/login" method="post" className="mt-8 space-y-4">
          <input type="hidden" name="next" value={next && next.startsWith("/") ? next : "/"} />

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-800">{copy.password}</span>
            <input
              required
              autoFocus
              type="password"
              name="password"
              className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900"
            />
          </label>

          {hasError ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {copy.error}
            </p>
          ) : null}

          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            {copy.submit}
          </button>
        </form>
      </section>
    </main>
  );
}
