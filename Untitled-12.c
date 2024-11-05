/**
 * Use pcre-10.00, compile with afl-clang-fast and asan.
 * git clone https://github.com/PCRE2Project/pcre2; git checkout pcre2-10.00
 * Compile with afl-clang-fast -fsanitize=address -Isrc -o harness harness.c .libs/libpcre2-8.a 
 * An input of a long string of 'a' can be used.
 */

#define PCRE2_CODE_UNIT_WIDTH 8
#define LINK_SIZE 2
#include "pcre2.h"
#include "pcre2_internal.h"
#include "pcre2posix.h"
#include <stdio.h>
#include <string.h>

/**
 * Redefine posix interfaces so we call pcre2 instead of the system implementation.
 */
int my_regcomp(regex_t *preg, const char *pattern, int cflags)
{
PCRE2_SIZE erroffset;
int errorcode;
int options = 0;
int re_nsub = 0;

if ((cflags & REG_ICASE) != 0)    options |= PCRE2_CASELESS;
if ((cflags & REG_NEWLINE) != 0)  options |= PCRE2_MULTILINE;
if ((cflags & REG_DOTALL) != 0)   options |= PCRE2_DOTALL;
if ((cflags & REG_NOSUB) != 0)    options |= PCRE2_NO_AUTO_CAPTURE;
if ((cflags & REG_UTF) != 0)      options |= PCRE2_UTF;
if ((cflags & REG_UCP) != 0)      options |= PCRE2_UCP;
if ((cflags & REG_UNGREEDY) != 0) options |= PCRE2_UNGREEDY;

preg->re_pcre2_code = 	((PCRE2_SPTR)pattern, -1, options,
  &errorcode, &erroffset, NULL);
preg->re_erroffset = erroffset;

if (preg->re_pcre2_code == NULL)
  {
  return REG_BADPAT;
  }

(void)pcre2_pattern_info((const pcre2_code *)preg->re_pcre2_code,
  PCRE2_INFO_CAPTURECOUNT, &re_nsub);
preg->re_nsub = (size_t)re_nsub;
if ((options & PCRE2_NO_AUTO_CAPTURE) != 0) re_nsub = -1;
preg->re_match_data = pcre2_match_data_create(re_nsub + 1, NULL);
return 0;
}



/*************************************************
*              Match a regular expression        *
*************************************************/

/* A suitable match_data block, large enough to hold all possible captures, was
obtained when the pattern was compiled, to save having to allocate and free it
for each match. If REG_NOSUB was specified at compile time, the
PCRE_NO_AUTO_CAPTURE flag will be set. When this is the case, the nmatch and
pmatch arguments are ignored, and the only result is yes/no/error. */

int  my_regexec(const regex_t *preg, const char *string, size_t nmatch,
  regmatch_t pmatch[], int eflags)
{
int rc, so, eo;
int options = 0;
pcre2_match_data *md = (pcre2_match_data *)preg->re_match_data;

if ((eflags & REG_NOTBOL) != 0) options |= PCRE2_NOTBOL;
if ((eflags & REG_NOTEOL) != 0) options |= PCRE2_NOTEOL;
if ((eflags & REG_NOTEMPTY) != 0) options |= PCRE2_NOTEMPTY;

((regex_t *)preg)->re_erroffset = (size_t)(-1);  /* Only has meaning after compile */

/* When no string data is being returned, or no vector has been passed in which
to put it, ensure that nmatch is zero. */

if ((((pcre2_real_code *)(preg->re_pcre2_code))->compile_options &
  PCRE2_NO_AUTO_CAPTURE) != 0 || pmatch == NULL) nmatch = 0;

/* REG_STARTEND is a BSD extension, to allow for non-NUL-terminated strings.
The man page from OS X says "REG_STARTEND affects only the location of the
string, not how it is matched". That is why the "so" value is used to bump the
start location rather than being passed as a PCRE2 "starting offset". */

if ((eflags & REG_STARTEND) != 0)
  {
  so = pmatch[0].rm_so;
  eo = pmatch[0].rm_eo;
  }
else
  {
  so = 0;
  eo = (int)strlen(string);
  }

rc = pcre2_match((const pcre2_code *)preg->re_pcre2_code,
  (PCRE2_SPTR)string + so, (eo - so), 0, options, md, NULL);

/* Successful match */

if (rc >= 0)
  {
  size_t i;
  if ((size_t)rc > nmatch) rc = (int)nmatch;
  for (i = 0; i < (size_t)rc; i++)
    {
    pmatch[i].rm_so = md->ovector[i*2];
    pmatch[i].rm_eo = md->ovector[i*2+1];
    }
  for (; i < nmatch; i++) pmatch[i].rm_so = pmatch[i].rm_eo = -1;
  return 0;
  }

/* Unsuccessful match */

if (rc <= PCRE2_ERROR_UTF8_ERR1 && rc >= PCRE2_ERROR_UTF8_ERR21)
  return REG_INVARG;

switch(rc)
  {
  default: return REG_ASSERT;
  case PCRE2_ERROR_BADMODE: return REG_INVARG;
  case PCRE2_ERROR_BADMAGIC: return REG_INVARG;
  case PCRE2_ERROR_BADOPTION: return REG_INVARG;
  case PCRE2_ERROR_BADUTFOFFSET: return REG_INVARG;
  case PCRE2_ERROR_MATCHLIMIT: return REG_ESPACE;
  case PCRE2_ERROR_NOMATCH: return REG_NOMATCH;
  case PCRE2_ERROR_NOMEMORY: return REG_ESPACE;
  case PCRE2_ERROR_NULL: return REG_INVARG;
  }
}

void my_regfree(regex_t *preg)
{
pcre2_match_data_free(preg->re_match_data);
pcre2_code_free(preg->re_pcre2_code);
}

static void process(char* buf, char* buf_dup, size_t buf_size)
{
  // Based on https://raw.githubusercontent.com/google/fuzzer-test-suite/master/pcre2-10.00/target.cc
  regex_t preg;
  int flags = buf[buf_size/2] - 'a';  // Make it 0 when the byte is 'a'.
  if (0 == my_regcomp(&preg, buf, flags)) {
    regmatch_t pmatch[5];
    my_regexec(&preg, buf_dup, 5, pmatch, 0);
    my_regfree(&preg);
    printf("%d %d\n", pmatch[0].rm_eo, pmatch[0].rm_so);
  }  
}

int main(int argc, char* argv[])
{
  if (argc < 2)
    return 1;

  FILE* fp = fopen(argv[1], "rb");
  if (!fp)
    return 1;
  
  fseek(fp, 0, SEEK_END);
  const size_t size = ftell(fp);
  fseek(fp, 0, SEEK_SET);

  char* buf = malloc(size + 1);
  buf[size] = 0;
  fread(buf, size, 1, fp);
  fclose(fp);

  char* buf_dup = malloc(size + 1);
  memcpy(buf_dup, buf, size + 1);

  process(buf, buf_dup, size);

  free(buf_dup);
  free(buf);
  return 0;
}
