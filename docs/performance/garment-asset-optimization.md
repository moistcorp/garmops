# Garment asset optimization

Renderer-only assets were normalized to exactly the signal consumed by `GarmentComposite`: mask alpha or rounded Rec. 709 luminance. Dimensions and signal hashes are recorded in `scripts/garment-asset-signals.json`. Candidates replace originals only when lossless signal verification succeeds and bytes decrease.

Total before: 38,750,955 bytes  
Total after: 38,628,689 bytes  
Reduction: 0.32%

| File | Before | After | Reduction |
|---|---:|---:|---:|
| public/garments/boxy-fit-hoodie/back/highlight.webp | 435832 | 435832 | 0.00% |
| public/garments/boxy-fit-hoodie/back/mask.png | 56702 | 54208 | 4.40% |
| public/garments/boxy-fit-hoodie/back/shadow.webp | 79956 | 79956 | 0.00% |
| public/garments/boxy-fit-hoodie/back/texture.webp | 516056 | 516056 | 0.00% |
| public/garments/boxy-fit-hoodie/front/highlight.webp | 455802 | 455802 | 0.00% |
| public/garments/boxy-fit-hoodie/front/mask.png | 54323 | 52445 | 3.46% |
| public/garments/boxy-fit-hoodie/front/shadow.webp | 89940 | 89940 | 0.00% |
| public/garments/boxy-fit-hoodie/front/texture.webp | 487128 | 487128 | 0.00% |
| public/garments/boxy-fit-hoodie/neck/highlight.webp | 881090 | 881090 | 0.00% |
| public/garments/boxy-fit-hoodie/neck/mask.png | 16928 | 15808 | 6.62% |
| public/garments/boxy-fit-hoodie/neck/shadow.webp | 113262 | 113262 | 0.00% |
| public/garments/boxy-fit-hoodie/neck/texture.webp | 860244 | 860244 | 0.00% |
| public/garments/boxy-fit-tee/back/highlight.webp | 376770 | 376770 | 0.00% |
| public/garments/boxy-fit-tee/back/mask.png | 42073 | 39822 | 5.35% |
| public/garments/boxy-fit-tee/back/shadow.webp | 45734 | 45734 | 0.00% |
| public/garments/boxy-fit-tee/back/texture.webp | 404180 | 404180 | 0.00% |
| public/garments/boxy-fit-tee/front/highlight.webp | 447170 | 419710 | 6.14% |
| public/garments/boxy-fit-tee/front/mask.png | 39888 | 37899 | 4.99% |
| public/garments/boxy-fit-tee/front/shadow.webp | 53178 | 53178 | 0.00% |
| public/garments/boxy-fit-tee/front/texture.webp | 442254 | 442254 | 0.00% |
| public/garments/boxy-fit-tee/neck/highlight.webp | 379686 | 379686 | 0.00% |
| public/garments/boxy-fit-tee/neck/mask.png | 21753 | 20440 | 6.04% |
| public/garments/boxy-fit-tee/neck/shadow.webp | 50812 | 50812 | 0.00% |
| public/garments/boxy-fit-tee/neck/texture.webp | 455308 | 455308 | 0.00% |
| public/garments/canvas-tote-bag/back/highlight.webp | 277626 | 277626 | 0.00% |
| public/garments/canvas-tote-bag/back/mask.png | 32721 | 30411 | 7.06% |
| public/garments/canvas-tote-bag/back/shadow.webp | 36886 | 36886 | 0.00% |
| public/garments/canvas-tote-bag/back/texture.webp | 281254 | 281254 | 0.00% |
| public/garments/canvas-tote-bag/front/highlight.webp | 277738 | 277738 | 0.00% |
| public/garments/canvas-tote-bag/front/mask.png | 32804 | 30462 | 7.14% |
| public/garments/canvas-tote-bag/front/shadow.webp | 36724 | 36724 | 0.00% |
| public/garments/canvas-tote-bag/front/texture.webp | 281080 | 281080 | 0.00% |
| public/garments/canvas-tote-bag/neck/highlight.webp | 580622 | 580622 | 0.00% |
| public/garments/canvas-tote-bag/neck/mask.png | 20298 | 19098 | 5.91% |
| public/garments/canvas-tote-bag/neck/shadow.webp | 48042 | 48042 | 0.00% |
| public/garments/canvas-tote-bag/neck/texture.webp | 597470 | 597470 | 0.00% |
| public/garments/longsleeve-tee/back/highlight.webp | 505678 | 505678 | 0.00% |
| public/garments/longsleeve-tee/back/mask.png | 52978 | 51233 | 3.29% |
| public/garments/longsleeve-tee/back/shadow.webp | 64710 | 64710 | 0.00% |
| public/garments/longsleeve-tee/back/texture.webp | 530744 | 530744 | 0.00% |
| public/garments/longsleeve-tee/front/highlight.webp | 522588 | 522588 | 0.00% |
| public/garments/longsleeve-tee/front/mask.png | 51826 | 50002 | 3.52% |
| public/garments/longsleeve-tee/front/shadow.webp | 66212 | 66212 | 0.00% |
| public/garments/longsleeve-tee/front/texture.webp | 539238 | 539238 | 0.00% |
| public/garments/longsleeve-tee/neck/highlight.webp | 592698 | 592698 | 0.00% |
| public/garments/longsleeve-tee/neck/mask.png | 23467 | 22076 | 5.93% |
| public/garments/longsleeve-tee/neck/shadow.webp | 74626 | 74626 | 0.00% |
| public/garments/longsleeve-tee/neck/texture.webp | 598962 | 598962 | 0.00% |
| public/garments/polo/back/highlight.webp | 466546 | 466546 | 0.00% |
| public/garments/polo/back/mask.png | 44180 | 42133 | 4.63% |
| public/garments/polo/back/shadow.webp | 53534 | 53534 | 0.00% |
| public/garments/polo/back/texture.webp | 519352 | 519352 | 0.00% |
| public/garments/polo/front/highlight.webp | 466482 | 466482 | 0.00% |
| public/garments/polo/front/mask.png | 43298 | 41128 | 5.01% |
| public/garments/polo/front/shadow.webp | 57254 | 57254 | 0.00% |
| public/garments/polo/front/texture.webp | 517198 | 517198 | 0.00% |
| public/garments/polo/neck/highlight.webp | 577630 | 577630 | 0.00% |
| public/garments/polo/neck/mask.png | 23548 | 22083 | 6.22% |
| public/garments/polo/neck/shadow.webp | 84576 | 84576 | 0.00% |
| public/garments/polo/neck/texture.webp | 589766 | 589766 | 0.00% |
| public/garments/regular-fit-hoodie/back/highlight.webp | 588434 | 588434 | 0.00% |
| public/garments/regular-fit-hoodie/back/mask.png | 56815 | 54832 | 3.49% |
| public/garments/regular-fit-hoodie/back/shadow.webp | 80162 | 80162 | 0.00% |
| public/garments/regular-fit-hoodie/back/texture.webp | 613584 | 610596 | 0.49% |
| public/garments/regular-fit-hoodie/front/highlight.webp | 496214 | 485266 | 2.21% |
| public/garments/regular-fit-hoodie/front/mask.png | 60042 | 58134 | 3.18% |
| public/garments/regular-fit-hoodie/front/shadow.webp | 83496 | 83496 | 0.00% |
| public/garments/regular-fit-hoodie/front/texture.webp | 507410 | 504160 | 0.64% |
| public/garments/regular-fit-sweatshirt/back/highlight.webp | 570320 | 550764 | 3.43% |
| public/garments/regular-fit-sweatshirt/back/mask.png | 55957 | 53540 | 4.32% |
| public/garments/regular-fit-sweatshirt/back/shadow.webp | 78958 | 78958 | 0.00% |
| public/garments/regular-fit-sweatshirt/back/texture.webp | 573818 | 570264 | 0.62% |
| public/garments/regular-fit-sweatshirt/front/highlight.webp | 427758 | 418290 | 2.21% |
| public/garments/regular-fit-sweatshirt/front/mask.png | 53252 | 51192 | 3.87% |
| public/garments/regular-fit-sweatshirt/front/shadow.webp | 78214 | 78214 | 0.00% |
| public/garments/regular-fit-sweatshirt/front/texture.webp | 464160 | 461958 | 0.47% |
| public/garments/regular-fit-sweatshirt/neck/highlight.webp | 557030 | 557030 | 0.00% |
| public/garments/regular-fit-sweatshirt/neck/mask.png | 23825 | 22449 | 5.78% |
| public/garments/regular-fit-sweatshirt/neck/shadow.webp | 54438 | 54438 | 0.00% |
| public/garments/regular-fit-sweatshirt/neck/texture.webp | 561012 | 561012 | 0.00% |
| public/garments/regular-fit-tee/back/highlight.webp | 3351526 | 3351526 | 0.00% |
| public/garments/regular-fit-tee/back/mask.png | 113808 | 113808 | 0.00% |
| public/garments/regular-fit-tee/back/shadow.webp | 3602226 | 3602226 | 0.00% |
| public/garments/regular-fit-tee/back/texture.webp | 1144173 | 1144173 | 0.00% |
| public/garments/regular-fit-tee/front/highlight.webp | 737289 | 737289 | 0.00% |
| public/garments/regular-fit-tee/front/mask.png | 119846 | 119846 | 0.00% |
| public/garments/regular-fit-tee/front/shadow.webp | 3935534 | 3935534 | 0.00% |
| public/garments/regular-fit-tee/front/texture.webp | 1132708 | 1132708 | 0.00% |
| public/garments/regular-fit-tee/neck/highlight.webp | 1242488 | 1242488 | 0.00% |
| public/garments/regular-fit-tee/neck/mask.png | 51663 | 46106 | 10.76% |
| public/garments/regular-fit-tee/neck/shadow.webp | 218242 | 218242 | 0.00% |
| public/garments/regular-fit-tee/neck/texture.webp | 740128 | 740128 | 0.00% |

Unchanged files: 63.
Optimized files: 29.
