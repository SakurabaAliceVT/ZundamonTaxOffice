const commentColors: { color: string; min: number; max: number }[] = [
    {
        color: 'blue',
        min: 100,
        max: 199,
    },
    {
        color: 'cyan',
        min: 200,
        max: 499,
    },
    {
        color: 'lime',
        min: 500,
        max: 999,
    },
    {
        color: 'yellow',
        min: 1000,
        max: 1999,
    },
    {
        color: 'orange',
        min: 2000,
        max: 4999,
    },
    {
        color: 'pink',
        min: 5000,
        max: 9999,
    },
    {
        color: 'red',
        min: 10000,
        max: 50000,
    },
];

function getRandom(max: number, min: number) {
    if (!Number.isInteger(max) || !Number.isInteger(min)) throw new Error('max and min must be integers');
    if (max < min) return getRandom(min, max);
    return max === min ? max : Math.floor(Math.random() * (max - min + 1)) + min;
}

export default function (): { color: string; price: number } {
    const colorIndex = getRandom(commentColors.length - 1, 0);
    return {
        color: commentColors[colorIndex].color,
        price: getRandom(commentColors[colorIndex].max, commentColors[colorIndex].min),
    };
}
