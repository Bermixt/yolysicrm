"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import Link from "next/link";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";

export default function Home() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shadow-sm">
        <h1 className="font-semibold text-slate-800 dark:text-slate-200">YolysiCRM</h1>
        <div className="flex items-center gap-4">
          <Link
            href="/import"
            className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium hover:underline underline-offset-2"
          >
            Import
          </Link>
          <SignOutButton />
        </div>
      </header>
      <main className="p-8 flex flex-col gap-8 max-w-2xl mx-auto">
        <Dashboard />
      </main>
    </>
  );
}

function SignOutButton() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const router = useRouter();

  if (!isAuthenticated) return null;

  return (
    <button
      className="bg-slate-600 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer"
      onClick={() => void signOut().then(() => router.push("/signin"))}
    >
      Sign out
    </button>
  );
}

function Dashboard() {
  const viewer = useQuery(api.myFunctions.getViewer);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Signed in as <span className="font-medium text-slate-700 dark:text-slate-300">{viewer ?? "…"}</span>
        </p>
        <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200">
          Welcome to YolysiCRM
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Your workspace for importing, verifying, and enriching e-commerce store leads.
        </p>
      </div>

      <div className="h-px bg-slate-200 dark:bg-slate-700" />

      <div className="flex flex-col gap-4">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200">What you can do</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FeatureCard
            number="1"
            title="Import leads"
            description="Upload a CSV exported from Store Leads or any other source. The system auto-detects the domain column and upserts records in bulk."
          />
          <FeatureCard
            number="2"
            title="Verify stores"
            description="Run live HTTP checks on each domain to confirm whether a store is active, inactive, or unreachable, and detect Shopify platforms automatically."
          />
          <FeatureCard
            number="3"
            title="Enrich data"
            description="Each verification pass extracts page title and meta description, giving you richer context on every store in your pipeline."
          />
        </div>
      </div>

      <div className="h-px bg-slate-200 dark:bg-slate-700" />

      <div className="flex flex-col gap-3">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200">Get started</h3>
        <Link
          href="/import"
          className="inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-white rounded-lg px-6 py-3 text-sm font-medium transition-all duration-200 shadow-md hover:shadow-lg w-fit"
        >
          Import stores →
        </Link>
      </div>
    </div>
  );
}

function FeatureCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
      <div className="w-7 h-7 rounded-full bg-slate-700 dark:bg-slate-600 text-white text-xs font-bold flex items-center justify-center">
        {number}
      </div>
      <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{title}</h4>
      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{description}</p>
    </div>
  );
}
