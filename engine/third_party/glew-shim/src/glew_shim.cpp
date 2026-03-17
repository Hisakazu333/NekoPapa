/*
 * Minimal GLEW shim — loads GL 2.0+ functions via wglGetProcAddress.
 */

#ifdef _WIN32

#include <GL/glew.h>

#define LOAD(name) name = (decltype(name))wglGetProcAddress(#name)

PFNGLCREATESHADERPROC            glCreateShader;
PFNGLSHADERSOURCEPROC            glShaderSource;
PFNGLCOMPILESHADERPROC           glCompileShader;
PFNGLGETSHADERIVPROC             glGetShaderiv;
PFNGLGETSHADERINFOLOGPROC        glGetShaderInfoLog;
PFNGLCREATEPROGRAMPROC           glCreateProgram;
PFNGLATTACHSHADERPROC            glAttachShader;
PFNGLLINKPROGRAMPROC             glLinkProgram;
PFNGLGETPROGRAMIVPROC            glGetProgramiv;
PFNGLGETPROGRAMINFOLOGPROC       glGetProgramInfoLog;
PFNGLUSEPROGRAMPROC              glUseProgram;
PFNGLDELETESHADERPROC            glDeleteShader;
PFNGLDELETEPROGRAMPROC           glDeleteProgram;
PFNGLGETUNIFORMLOCATIONPROC      glGetUniformLocation;
PFNGLGETATTRIBLOCATIONPROC       glGetAttribLocation;
PFNGLUNIFORM1IPROC              glUniform1i;
PFNGLUNIFORM1FPROC              glUniform1f;
PFNGLUNIFORM2FPROC              glUniform2f;
PFNGLUNIFORM4FPROC              glUniform4f;
PFNGLUNIFORMMATRIX4FVPROC       glUniformMatrix4fv;
PFNGLVERTEXATTRIBPOINTERPROC    glVertexAttribPointer;
PFNGLENABLEVERTEXATTRIBARRAYPROC glEnableVertexAttribArray;
PFNGLDISABLEVERTEXATTRIBARRAYPROC glDisableVertexAttribArray;
PFNGLACTIVETEXTUREPROC           glActiveTexture;
PFNGLGENBUFFERSPROC              glGenBuffers;
PFNGLDELETEBUFFERSPROC           glDeleteBuffers;
PFNGLBINDBUFFERPROC              glBindBuffer;
PFNGLBUFFERDATAPROC              glBufferData;
PFNGLBUFFERSUBDATAPROC           glBufferSubData;
PFNGLGENFRAMEBUFFERSPROC         glGenFramebuffers;
PFNGLDELETEFRAMEBUFFERSPROC      glDeleteFramebuffers;
PFNGLBINDFRAMEBUFFERPROC         glBindFramebuffer;
PFNGLFRAMEBUFFERTEXTURE2DPROC    glFramebufferTexture2D;
PFNGLCHECKFRAMEBUFFERSTATUSPROC  glCheckFramebufferStatus;
PFNGLGENRENDERBUFFERSPROC        glGenRenderbuffers;
PFNGLDELETERENDERBUFFERSPROC     glDeleteRenderbuffers;
PFNGLBINDRENDERBUFFERPROC        glBindRenderbuffer;
PFNGLRENDERBUFFERSTORAGEPROC     glRenderbufferStorage;
PFNGLFRAMEBUFFERRENDERBUFFERPROC glFramebufferRenderbuffer;
PFNGLBLENDEQUATIONPROC           glBlendEquation;
PFNGLBLENDFUNCSEPARATEPROC       glBlendFuncSeparate;
PFNGLBLENDEQUATIONSEPARATEPROC   glBlendEquationSeparate;
PFNGLGENERATEMIPMAPPROC          glGenerateMipmap;

extern "C" int glewInit(void) {
    LOAD(glCreateShader);
    LOAD(glShaderSource);
    LOAD(glCompileShader);
    LOAD(glGetShaderiv);
    LOAD(glGetShaderInfoLog);
    LOAD(glCreateProgram);
    LOAD(glAttachShader);
    LOAD(glLinkProgram);
    LOAD(glGetProgramiv);
    LOAD(glGetProgramInfoLog);
    LOAD(glUseProgram);
    LOAD(glDeleteShader);
    LOAD(glDeleteProgram);
    LOAD(glGetUniformLocation);
    LOAD(glGetAttribLocation);
    LOAD(glUniform1i);
    LOAD(glUniform1f);
    LOAD(glUniform2f);
    LOAD(glUniform4f);
    LOAD(glUniformMatrix4fv);
    LOAD(glVertexAttribPointer);
    LOAD(glEnableVertexAttribArray);
    LOAD(glDisableVertexAttribArray);
    LOAD(glActiveTexture);
    LOAD(glGenBuffers);
    LOAD(glDeleteBuffers);
    LOAD(glBindBuffer);
    LOAD(glBufferData);
    LOAD(glBufferSubData);
    LOAD(glGenFramebuffers);
    LOAD(glDeleteFramebuffers);
    LOAD(glBindFramebuffer);
    LOAD(glFramebufferTexture2D);
    LOAD(glCheckFramebufferStatus);
    LOAD(glGenRenderbuffers);
    LOAD(glDeleteRenderbuffers);
    LOAD(glBindRenderbuffer);
    LOAD(glRenderbufferStorage);
    LOAD(glFramebufferRenderbuffer);
    LOAD(glBlendEquation);
    LOAD(glBlendFuncSeparate);
    LOAD(glBlendEquationSeparate);
    LOAD(glGenerateMipmap);
    return GLEW_OK;
}

#undef LOAD

#endif /* _WIN32 */
