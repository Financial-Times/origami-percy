# Percy for Origami Components

A GitHub action to visually test Origami Components with Percy. 

## Quick start

To use the Percy snapshot GitHub action you will need to add a new step to your
actions config using the `Financial-Times/origami-percy` action. You will also need
to set your `PERCY_TOKEN` in your GitHub projects settings.

Below is a sample config:

``` yaml
name: Percy
on: 
  pull_request:
    types:
      - labeled
      - opened
      - reopened
      - synchronize
  push:
    branches: master
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@master
      - name: Percy Test
        uses: Financial-Times/origami-percy
        env:
          PERCY_TOKEN: ${{ secrets.PERCY_TOKEN }}
```
