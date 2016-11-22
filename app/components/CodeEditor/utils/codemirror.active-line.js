// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: http://codemirror.net/LICENSE

// Because sometimes you need to style the cursor's line.
//
// Adds an option 'styleActiveLine' which, when enabled, gives the
// active line's wrapping <div> the CSS class "CodeMirror-activeline",
// and gives its background <div> the class "CodeMirror-activeline-background".

(function (mod) {
  if (typeof exports == 'object' && typeof module == 'object') // CommonJS
    {
    mod(require('codemirror'))
  } else if (typeof define == 'function' && define.amd) // AMD
    {
    define(['codemirror'], mod)
  } else // Plain browser env
    {
    mod(CodeMirror)
  }
}((CodeMirror) => {
  const WRAP_CLASS = 'CodeMirror-activeline'
  const BACK_CLASS = 'CodeMirror-activeline-background'
  const GUTT_CLASS = 'CodeMirror-activeline-gutter'

  CodeMirror.defineOption('styleActiveLine', false, (cm, val, old) => {
    const prev = old && old != CodeMirror.Init
    if (val && !prev) {
      cm.state.activeLines = []
      updateActiveLines(cm, cm.listSelections())
      cm.on('beforeSelectionChange', selectionChange)
    } else if (!val && prev) {
      cm.off('beforeSelectionChange', selectionChange)
      clearActiveLines(cm)
      delete cm.state.activeLines
    }
  })

  function clearActiveLines(cm) {
    for (let i = 0; i < cm.state.activeLines.length; i++) {
      cm.removeLineClass(cm.state.activeLines[i], 'wrap', WRAP_CLASS)
      cm.removeLineClass(cm.state.activeLines[i], 'background', BACK_CLASS)
      cm.removeLineClass(cm.state.activeLines[i], 'gutter', GUTT_CLASS)
    }
  }

  function sameArray(a, b) {
    if (a.length != b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (a[i] != b[i]) return false
    }
    return true
  }

  function updateActiveLines(cm, ranges) {
    const active = []
    for (let i = 0; i < ranges.length; i++) {
      const range = ranges[i]
      if (!range.empty()) continue
      const line = cm.getLineHandleVisualStart(range.head.line)
      if (active[active.length - 1] != line) active.push(line)
    }
    if (sameArray(cm.state.activeLines, active)) return
    cm.operation(() => {
      clearActiveLines(cm)
      for (let i = 0; i < active.length; i++) {
        cm.addLineClass(active[i], 'wrap', WRAP_CLASS)
        cm.addLineClass(active[i], 'background', BACK_CLASS)
        cm.addLineClass(active[i], 'gutter', GUTT_CLASS)
      }
      cm.state.activeLines = active
    })
  }

  function selectionChange(cm, sel) {
    updateActiveLines(cm, sel.ranges)
  }
}))
