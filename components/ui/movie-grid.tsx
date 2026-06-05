import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function MovieGrid({
  movies,
}: Readonly<{
  movies: { title: string; image: string }[];
}>) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {movies.map((movie, index) => (
        <Tooltip key={index}>
          <TooltipTrigger>
            <Card className="bg-transparent border-0">
              <CardContent>
                <img
                  src={movie.image}
                  alt={movie.title}
                  className="w-full h-auto rounded-md"
                />
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent>
            <p>{movie.title}</p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
