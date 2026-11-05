# Visualization for Various Similarity Functions

[![The euclidean distance forming voronoi regions.](media/demo0.gif)](https://searchspace.josuakrause.com/)

This visualization shows distances of various similarity functions in a 2D vector space.
Choose the distance function from the menu or use the number keys to quickly switch between them.
You can also add or remove points interactively. Boundaries of closest neighbor regions are shown in red.
Read more about the visualization on [Medium](https://medium.com/@josua.krause/aff7667da6cc?source=friends_link&sk=1a7e02ec41f35b625fe5eb08da8623cb).

The live version can be found [here](https://searchspace.josuakrause.com/).

## Sharing a View

The URL always reflects the current state, so it can be copied and shared.
Only settings that differ from the page's defaults appear in it:

| Parameter | Meaning                                                           | Example                        |
| --------- | ----------------------------------------------------------------- | ------------------------------ |
| `metric`  | Distance function, by name in lowercase with dashes               | `metric=cos`, `metric=adj-dot` |
| `points`  | Point coordinates as `x,y` pairs in one list; empty for no points | `points=0.4,0.2,-0.5,0.8`      |
| `unit`    | Unit circle, `1` or `0`                                           | `unit=0`                       |
| `hull`    | Convex hull, `1` or `0`                                           | `hull=0`                       |
| `corr`    | Correction                                                        | `corr=3.5`                     |
| `view`    | View (zoom)                                                       | `view=2`                       |
| `grid`    | Grid, `1` or `0`                                                  | `grid=1`                       |
| `pos`     | Cursor position, set on click                                     | `pos=0.1,-0.2`                 |

Invalid values, and settings a page does not offer, are ignored.
Other parameters, like `ref`, are left as they are.

## Running Locally

The whole repo can be served as is. There is no build step needed.
For convenience the `make run-web` command exists to start a local file server.
`npm test` runs the unit tests.

## Converting Videos

After recording a video using the `Record` button it is saved in the `webm` format.
If a `gif` is needed, the command `make convert INPUT=~/Downloads/video.webm` converts the
specified `webm` video and places the `gif` version into the same folder. `ffmpeg` is required.

## Contributing

If you encounter any bugs or problems, feel free to file an [issue](https://github.com/JosuaKrause/searchspace/issues).
