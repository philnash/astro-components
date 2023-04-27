<div style="text-align:center" align="center">
  <h1>🚀 Astro Pagination 🚀</h1>

  <p><em>A flexible, accessible `<Pagination>` component for displaying links to next, previous, first, last and a window of pages in your Astro site.</em></p>
</div>

* [Installation](#installation)
* [Usage](#usage)
  * [Required options](#required-options)
    * [`page` (`Page<T>`)](#page-paget)
    * [`urlPattern` (`string`)](#urlpattern-string)
  * [Options and advanced usage](#options-and-advanced-usage)
    * [`windowSize` (`number`, default: 5)](#windowsize-number-default-5)
    * [`showPrevNext` (`boolean`, default: true)](#showprevnext-boolean-default-true)
    * [`previousLabel` (`string`, default: "« Prev")](#previouslabel-string-default--prev)
    * [`nextLabel` (`string`, default: "Next »")](#nextlabel-string-default-next-)
    * [`showFirstLast` (`boolean`, default: true)](#showfirstlast-boolean-default-true)
    * [`firstPageUrl` (`string`)](#firstpageurl-string)
* [License](#license)

## Installation

Install the component using npm:

```
npm install @philnash/astro-pagination
```

## Usage

If you are displaying a page that uses the `Page` type, you can pass that `Page` to this component and it will render a set of links to other pages. You also need to pass a URL pattern for how the paths to each page are created. A URL pattern should contain the URL itself and empty brace `{}` where the page number goes.

For example:

```astro
---
import { Pagination } from "@philnash/astro-pagination";
type Props = {
  page: Page<CollectionEntry<"blog">>;
};

const { page } = Astro.props;
---

<Pagination page={page} urlPattern={"/blog/page/{}"} />
```

The above code will render a result like:

```html
<nav role="navigation" aria-label="Pagination">
  <ul>
    <li>
      <a
        href="/blog/page/4"
        class="previous-page"
        aria-label="Go to previous page"
        >« Prev</a
      >
    </li>
    <li>
      <a class="number" href="/blog/page" aria-label="Go to page 1"> 1 </a>
    </li>
    <li>
      <span>…</span>
    </li>
    <li>
      <a class="number" href="/blog/page/3" aria-label="Go to page 3"> 3 </a>
    </li>
    <li>
      <a class="number" href="/blog/page/4" aria-label="Go to page 4"> 4 </a>
    </li>
    <li>
      <em aria-current="page" aria-label="Current page, page 5"> 5 </em>
    </li>
    <li>
      <a class="number" href="/blog/page/6" aria-label="Go to page 6"> 6 </a>
    </li>
    <li>
      <a class="number" href="/blog/page/7" aria-label="Go to page 7"> 7 </a>
    </li>
    <li>
      <span>…</span>
    </li>
    <li>
      <a class="number" href="/blog/page/10" aria-label="Go to page 10"> 10 </a>
    </li>
    <li>
      <a href="/blog/page/6" class="next-page" aria-label="Go to next page"
        >Next »</a
      >
    </li>
  </ul>
</nav>
```

The pagination markup is surrounded by a `<nav>` element which has a `role` of "navigation" and an `aria-label` describing it as "pagination" for assistive technologies.

It creates a list of links to make it easy to navigate, including links for the previous and next page, links for the first and last pages, ellipses to show a gap, and a window of links around the current page. For each of the links there is also an `aria-label` to describe the link. The current page is not linked, and has the attribute `aria-current="page"` as well as being labelled as the current page.

### Required options

#### `page` (`Page<T>`)

The `page` as provided by the props to the page.

#### `urlPattern` (`string`)

A URL pattern should contain the path and an empty brace `{}` where the page number goes. For example, "/blog/page/{}"

### Options and advanced usage

You can control a number of options for the pagination component by passing different properties. Those properties are listed below:

#### `windowSize` (`number`, default: 5)

The number of links that appear around the current page. It is best to choose an odd number so that the number of links either side are even.

#### `showPrevNext` (`boolean`, default: true)

Whether to show the previous and next links

#### `previousLabel` (`string`, default: "&laquo; Prev")

The label of the previous link

#### `nextLabel` (`string`, default: "Next &raquo;")

The label of the next link

#### `showFirstLast` (`boolean`, default: true)

Whether to show the first and last links

#### `firstPageUrl` (`string`)

By default this component will set the first link as something like "/blog/page" and subsequent pages, as "/blog/page/${n}". I personally have the first page of my blog at "/blog" and then subsequent pages at "/blog/page/${n}", and to accomplish this I set the `firstPageUrl` to "/blog"

An example using some of these options might look like this:

```astro
---
type Props = {
  page: Page<CollectionEntry<"blog">>;
};

const { page } = Astro.props;
---

<Pagination
  page={page}
  urlPattern={"/items/page/{}"}
  firstPageUrl="/items"
  windowSize={3}
  showPrevNext={false}
/>
```

This would create something like:

```html
<nav role="navigation" aria-label="Pagination">
  <ul>
    <li>
      <a class="number" href="/items" aria-label="Go to page 1"> 1 </a>
    </li>
    <li>
      <span>…</span>
    </li>
    <li>
      <a class="number" href="/blog/page/4" aria-label="Go to page 4"> 4 </a>
    </li>
    <li>
      <em aria-current="page" aria-label="Current page, page 5"> 5 </em>
    </li>
    <li>
      <a class="number" href="/blog/page/6" aria-label="Go to page 6"> 6 </a>
    </li>
    <li>
      <span>…</span>
    </li>
    <li>
      <a class="number" href="/blog/page/10" aria-label="Go to page 10"> 10 </a>
    </li>
  </ul>
</nav>
```

## License

MIT (c) Phil Nash 2023
