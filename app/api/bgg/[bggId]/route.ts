import { NextResponse } from 'next/server';
import { bgg } from '@/lib/bgg/client'; // ajusta ruta si es distinta

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ bggId: string }> }
) {
  const { bggId } = await params;

  if (!bggId) {
    return NextResponse.json(
      { message: 'Missing bggId' },
      { status: 400 }
    );
  }

  try {
    // Usamos tu cliente existente
    const things = await bgg.thing(bggId, { stats: true });
    const thing = things[0];

    if (!thing) {
      return NextResponse.json(
        { message: 'Game not found in BGG' },
        { status: 404 }
      );
    }

    const response = {
      id: Number(thing.id),
      name: thing.name,
      description: thing.description || undefined,
      yearPublished: thing.yearPublished,
      minPlayers: thing.minPlayers,
      maxPlayers: thing.maxPlayers,
      playingTime: thing.playingTime,
      minPlayTime: thing.minPlayTime,
      maxPlayTime: thing.maxPlayTime,
      // minAge no está en BggThing actual; si lo necesitas hay que extender el client
      minAge: undefined,
      mechanics: thing.mechanics ?? [],
      avgRating: thing.stats?.average,
      bayesAverageRating: thing.stats?.bayesAverage,
      // weight tampoco está en tu client actual; puedes añadirlo en BggClient si quieres
      averageWeightRating: undefined,
      categories: thing.categories ?? [],
      designers: thing.designers ?? [],
      publishers: thing.publishers ?? [],
    };

    return NextResponse.json(response);
  } catch (err: any) {
    console.error('Error fetching BGG', err);
    return NextResponse.json(
      { message: 'Error fetching BGG data' },
      { status: 500 }
    );
  }
}