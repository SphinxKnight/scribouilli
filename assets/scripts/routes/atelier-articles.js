// @ts-check

import lireFrontMatter from 'front-matter'
import page from 'page'

import store from '../store'
import {
  checkRepositoryAvailabilityThen,
  handleErrors,
  makeArticleFileName,
  makeFrontMatterYAMLJsaisPasQuoiLa,
} from '../utils'

import databaseAPI from '../databaseAPI'
import { svelteTarget } from '../config'
import { replaceComponent } from '../routeComponentLifeCycle'
import ArticleContenu from '../components/screens/ArticleContenu.svelte'
import { setCurrentRepositoryFromQuerystring } from '../actions'

const LIST_ARTICLE_URL = '/atelier-list-articles'

const makeMapStateToProps = fileName => state => {
  // Display existing file
  let file
  if (fileName) {
    file = Promise.resolve(store.state.login).then(login => {
      if (!login) {
        page('/login')
        return
      }

      return databaseAPI
        .getFile(login, store.state.currentRepository.name, fileName)
        .then(contenu => {
          const { attributes: data, body: markdownContent } =
            lireFrontMatter(contenu)

          return {
            fileName: fileName,
            content: markdownContent,
            previousContent: markdownContent,
            title: data?.title,
            previousTitle: data?.title,
          }
        })
        .catch(msg => handleErrors(msg))
    })
    return {
      fileP: file,
      contenus: state.articles,
      buildStatus: state.buildStatus,
      showArticles:
        state.pages.find(p => p.path === 'blog.md') !== undefined ||
        state.articles?.length > 0,
      currentRepository: state.currentRepository,
    }
  } else {
    return {
      fileP: Promise.resolve({
        fileName: '',
        content: '',
        previousContent: undefined,
        title: '',
        previousTitle: undefined,
      }),
      contenus: state.articles,
      buildStatus: state.buildStatus,
      showArticles:
        state.pages.find(p => p.path === 'blog.md') !== undefined ||
        state.articles?.length > 0,
      currentRepository: state.currentRepository,
    }
  }
}

export default ({ querystring }) => {
  setCurrentRepositoryFromQuerystring(querystring)

  Promise.resolve(store.state.login).then(async login => {
    if (!login) return page('/login')

    return checkRepositoryAvailabilityThen(
      login,
      store.state.currentRepository.name,
      () => {},
    )
  })

  const state = store.state
  const currentRepository = state.currentRepository
  const fileName = new URLSearchParams(querystring).get('path') ?? ''
  const mapStateToProps = makeMapStateToProps(fileName)

  const articleContenu = new ArticleContenu({
    target: svelteTarget,
    props: mapStateToProps(store.state),
  })

  replaceComponent(articleContenu, mapStateToProps)

  articleContenu.$on('delete', () => {
    Promise.resolve(state.login).then(login => {
      if (!login) return page('/login')

      store.mutations.setArticles(
        (state.articles ?? []).filter(article => {
          return article.path !== fileName
        }),
      )
      databaseAPI
        .deleteFile(login, state.currentRepository.name, fileName)
        .then(() => {
          state.buildStatus.setBuildingAndCheckStatusLater()
          page(
            `${LIST_ARTICLE_URL}?repoName=${currentRepository.name}&account=${currentRepository.owner}`,
          )
        })
        .catch(msg => handleErrors(msg))
    })
    page(
      `/atelier-list-pages?repoName=${currentRepository.name}&account=${currentRepository.owner}`,
    )
  })

  articleContenu.$on(
    'save',
    ({
      detail: { fileName, content, previousContent, title, previousTitle },
    }) => {
      const hasContentChanged = content !== previousContent
      const hasTitleChanged = title !== previousTitle

      // If no content changed, just redirect
      if (!hasTitleChanged && !hasContentChanged) {
        page(
          `${LIST_ARTICLE_URL}?repoName=${currentRepository.name}&account=${currentRepository.owner}`,
        )
        return
      }

      const existingDate = fileName.slice(
        '_posts/'.length,
        '_posts/YYYY-MM-DD'.length,
      )
      let date = new Date()
      if (existingDate !== '') {
        date = new Date(existingDate)
      }

      const newFileName = makeArticleFileName(title, date)

      const message = `création de l'article ${title || 'index.md'}`
      const finalContent = `${
        title ? makeFrontMatterYAMLJsaisPasQuoiLa(title) + '\n' : ''
      }${content}`

      let newArticles =
        state.articles?.filter(article => {
          return article.path !== fileName
        }) || []
      newArticles.push({ title: title, path: newFileName })

      store.mutations.setArticles(newArticles)

      // if creating a new article
      if (fileName === '') {
        fileName = newFileName
      }

      // If title changed
      if (fileName && fileName !== newFileName) {
        fileName = {
          old: fileName,
          new: newFileName,
        }
      }

      Promise.resolve(state.login).then(login => {
        if (!login) return page('/')

        databaseAPI
          .writeFile(
            login,
            state.currentRepository.name,
            fileName,
            finalContent,
            message,
          )
          .then(() => {
            state.buildStatus.setBuildingAndCheckStatusLater()
            page(
              `${LIST_ARTICLE_URL}?repoName=${currentRepository.name}&account=${currentRepository.owner}`,
            )
          })
          .catch(msg => handleErrors(msg))
      })
    },
  )
}
