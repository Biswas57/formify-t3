"use client";

import { api } from "@/trpc/react";

export function LatestPost() {
  const { data: greeting } = api.post.hello.useQuery({ text: "World" });

  return (
    <div className="w-full max-w-xs">
      <p className="text-center">{greeting?.greeting ?? "Loading..."}</p>
      <p className="text-sm text-gray-500 mt-2">
        TODO: Add Formify-specific functionality here
      </p>
    </div>
  );
}
