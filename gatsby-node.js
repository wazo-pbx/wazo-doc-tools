const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { execSync } = require('child_process');
const showdown = require('showdown');
const algoliasearch = require('algoliasearch');
const striptags = require('striptags');
const RSS = require('rss');

const config = require('./config');

const markdownConverter = new showdown.Converter();
const overviews = {};
const forDeveloper = !!process.env.FOR_DEVELOPER;

const siteUrl = forDeveloper ? 'http://developers.wazo.io' : 'https://wazo-platform.org';
const siteTitle = 'Wazo Platform Blog';

let hasSearch = config.algolia && !!config.algolia.appId && !!config.algolia.apiKey;

let algoliaIndex = null;

if (hasSearch) {
  const algoliaClient = algoliasearch(config.algolia.appId, config.algolia.apiKey);
  algoliaIndex = algoliaClient.initIndex('wazo-doc-overview');
  algoliaIndex.setSettings(
    {
      attributeForDistinct: 'title',
      attributesToHighlight: ['title', 'content'],
      attributesToSnippet: ['content'],
      distinct: true,
    },
    err => {
      if (err) {
        hasSearch = false;
        console.error('Algolia error:' + err.message);
      }
    }
  );
}

const walk = dir => {
  const files = fs.readdirSync(dir);
  const dirname = dir.split('/').pop();

  console.info('processing ' + dir);

  files.forEach(file => {
    const filePath = dir + '/' + file;

    if (fs.statSync(filePath).isDirectory()) {
      walk(filePath);
    } else if (file === 'description.md') {
      overviews[dirname] = fs.readFileSync(filePath, 'utf8');
    }
  });
};

const getArticles = async createPage => {
  const dir = './content/blog';
  const articles = [];
  const files = fs.readdirSync(dir);
  console.info('generating articles');

  var rssFeed = new RSS({
    title: siteTitle,
    description: 'Wazo Platform - An Open Source project to build your own IP telecom platform.',
    language: 'en',
    image_url: `${siteUrl}/images/og-image.jpg`,
    feed_url: `${siteUrl}/rss.xml`,
    site_url: `${siteUrl}/`,
  });

  files.forEach((file, key) => {
    const filePath = `${dir}/${file}`;

    const content = fs.readFileSync(filePath, 'utf8');
    const body = content
      .split('\n')
      .splice(8)
      .join('\n');
    const options = {};
    content
      .split('\n')
      .splice(0, 7)
      .forEach(row => {
        const [key, value] = row.split(': ');
        options[key.toLowerCase()] = value;
      });

    const summaryNumWords = 40;
    options.summary = striptags(markdownConverter.makeHtml(body))
      .split(' ')
      .splice(0, summaryNumWords)
      .join(' ');

    const blogPath = `/blog/${options.slug}`;
    if (!fs.statSync(filePath).isDirectory() && options.status === 'published') {
      console.info(`generating article ${key}`);

      articles.push(options);

      createPage({
        path: blogPath,
        component: path.resolve(`src/component/blog/article.js`),
        context: {
          ...options,
          body,
        },
      });

      rssFeed.item({
        title: options.title,
        description: options.summary+'...',
        url: `${siteUrl}${blogPath}`,
        author: options.author,
        categories: [options.category],
        date: options.date.indexOf(':') !== -1 ? options.date : `${options.date} 14:00:00`,
        enclosure: {
          url: `${siteUrl}/images/og-image.jpg` // @todo change image, change when og:image per article
        }
      });
    }
  });

  console.log('generating articles rss feed');
  fs.writeFile(__dirname + '/public/rss.xml', rssFeed.xml({ indent: true }), (err) => {
    if (err) console.log(err);
  });

  return articles;
};

const walk_md_files = (dir, path, acc, index) => {
  const files = fs.readdirSync(dir);

  console.info('scanning dir ' + dir);

  files.forEach(file => {
    const filePath = dir + '/' + file;

    if (fs.statSync(filePath).isDirectory()) {
      if (file !== '.') {
        walk_md_files(filePath, path + file + '/', acc, index);
      }
    } else if (file === index) {
      console.info('storing index ' + path);
      acc[path] = fs.readFileSync(filePath, 'utf8');
    } else {
      const names = file.split('.');
      const ext = names.pop();
      const fname = names.pop();
      if (ext === 'md') {
        const p = path + fname;
        console.info('storing ' + p);
        acc[p] = fs.readFileSync(filePath, 'utf8');
      }
    }
  });
  return acc;
};

exports.createPages = async ({ graphql, actions: { createPage } }) => {
  console.log(`Building ${siteUrl}`);
  try {
    fs.writeFile('config-wazo.js', `export const forDeveloper = ${forDeveloper ? 'true' : 'false'};`, () => null);
  } catch (e) {
    console.error(e);
  }

  const ecosystemDoc = fs.readFileSync('./content/ecosystem.md', 'utf8');
  const installDoc = fs.readFileSync('./content/install.md', 'utf8');
  const installUCDoc = fs.readFileSync('./content/install-uc.md', 'utf8');
  const installC4Doc = fs.readFileSync('./content/install-c4.md', 'utf8');
  const contributeDoc = fs.readFileSync('./content/contribute.md', 'utf8');
  const rawSections = yaml.safeLoad(fs.readFileSync('./content/sections.yaml', { encoding: 'utf-8' }));
  // when FOR_DEVELOPER is set do not filter section, otherwise only display what is not for developer
  const sections = rawSections.filter(section => (!forDeveloper ? !section.developer : true));
  const contributeDocs = walk_md_files('content/contribute', '', {}, 'description.md');
  const allModules = sections.reduce((acc, section) => {
    Object.keys(section.modules).forEach(moduleName => (acc[moduleName] = section.modules[moduleName]));
    return acc;
  }, {});

  const getModuleName = repoName =>
    Object.keys(allModules).find(moduleName => {
      const { repository } = allModules[moduleName];

      return repository && repoName === repository.replace('wazo-', '');
    });

  // Helper to generate page
  const newPage = (modulePath, component, context) =>
    createPage({
      path: modulePath,
      component: path.resolve(`src/component/${component}.js`),
      context,
    });

  // Retrieve all diagrams
  const diagramOutputDir = path.resolve('public/diagrams/');
  execSync(`mkdir -p ${diagramOutputDir}`);
  execSync(`rm -rf ${diagramOutputDir}/*`);
  walk('content');

  // Generate puml to svg
  console.info(`generating svg diagrams in ${diagramOutputDir}...`);
  execSync(
    `set -e; cp content/plantuml/* ${diagramOutputDir}/; for f in $(find content -name '*.puml'|grep -v /plantuml/); do cp $f ${diagramOutputDir}/$(basename $(dirname $f))-$(basename $f); done; java -jar $JAVA_HOME/lib/plantuml.jar -tsvg ${diagramOutputDir}/*.puml; rm -f ${diagramOutputDir}/*.puml`
  );
  console.info(`done generating svg diagrams`);

  // Update algolia index
  if (hasSearch) {
    await new Promise(resolve => algoliaIndex.clearIndex(resolve));
    const algoliaObjects = Object.keys(overviews).reduce((acc, repoName) => {
      const moduleName = getModuleName(repoName);
      const module = allModules[moduleName];
      const htmlContent = markdownConverter.makeHtml(overviews[repoName]);
      const content = striptags(htmlContent);

      acc.push({
        repository: repoName,
        moduleName,
        title: module.title,
        description: module.description,
        content,
      });

      return acc;
    }, []);

    algoliaIndex.addObjects(algoliaObjects);
  }

  const articles = await getArticles(createPage);

  // Create homepage
  await newPage('/', forDeveloper ? 'dev/index' : 'home/index', forDeveloper ? { sections, overviews } : null);

  // Create doc page
  await newPage('/documentation', 'documentation/index', { sections, overviews });
  // Create install page
  await newPage('/install', 'install/index', { installDoc });
  // Create install-uc page
  await newPage('/install/unified-communication', 'install_uc/index', { installUCDoc });
  // Create install-uc page
  await newPage('/install/class-4', 'install_c4/index', { installC4Doc });
  // Create contribute page
  await newPage('/contribute', 'contribute/index', { content: contributeDoc });
  // Create blog page
  await newPage('/blog', 'blog/index', { articles });
  // Create ecosystem page
  await newPage('/ecosystem', 'ecosystem/index', { content: ecosystemDoc });

  // Create contribute pages
  Object.keys(contributeDocs).forEach(fileName => {
    const rawContent = contributeDocs[fileName].split('\n');
    const title = rawContent[0];
    rawContent.shift();
    rawContent.shift();
    const content = rawContent.join('\n');
    var p = '/contribute/' + path.basename(fileName, '.md');
    console.log('generating ' + p);
    newPage(p, 'contribute/index', { content, title });
  });

  // Create uc-doc pages
  // ---------
  const ucDocsResult = await graphql(`
    {
      allMarkdownRemark(filter: {fileAbsolutePath: {regex: "/uc-doc/"} }) {
        edges {
          node {
            id
            fileAbsolutePath
            frontmatter {
              title
              subtitle
            }
            html
            description: excerpt(pruneLength: 200)
          }
        }
      }
    }
  `)

  // Handle errors
  if (ucDocsResult.errors) {
    reporter.panicOnBuild(`Error while running UC-DOC GraphQL query.`)
    return;
  }

  ucDocsResult.data.allMarkdownRemark.edges.forEach(({ node }) => {
    const pagePath = node.fileAbsolutePath.split('content/')[1].split('.')[0].replace("index", "");
    newPage(
      pagePath,
      'uc-doc/index',
      {
        content: node.html,
        title: node.frontmatter.title,
        pagePath,
      },
    )
  })


  // Create api pages
  // ----------
  sections.forEach(section =>
    Object.keys(section.modules).forEach(moduleName =>
      newPage(`/documentation/api/${moduleName}.html`, 'documentation/api', {
        moduleName,
        module: section.modules[moduleName],
      })
    )
  );

  // Create console pages
  sections.forEach(section =>
    Object.keys(section.modules).forEach(
      moduleName =>
        !!section.modules[moduleName].redocUrl &&
        newPage(`/documentation/console/${moduleName}`, 'documentation/console', {
          moduleName,
          module: section.modules[moduleName],
          modules: section.modules,
        })
    )
  );

  // Create overview and extra pages
  Object.keys(allModules).forEach(moduleName => {
    const module = allModules[moduleName];
    const repoName = module.repository;
    if (!repoName) {
      return;
    }

    newPage(`/documentation/overview/${moduleName}.html`, 'documentation/overview', {
      overview: overviews[repoName.replace('wazo-', '')],
      moduleName,
      module,
    });

    const dir = 'content/' + repoName.replace('wazo-', '');
    const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
    files.forEach((file, key) => {
      if (file.endsWith('.md') && file != 'description.md') {
        const filePath = `${dir}/${file}`;
        const baseName = file.replace('.md', '');
        const content = fs.readFileSync(filePath, 'utf8');
        console.log(`generating /documentation/overview/${moduleName}-${baseName}.html`);
        newPage(`/documentation/overview/${moduleName}-${baseName}.html`, 'documentation/overview', {
          overview: content,
          moduleName,
          module,
        });
      }
    });
  });
};
