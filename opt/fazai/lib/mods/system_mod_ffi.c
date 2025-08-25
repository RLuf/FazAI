// Minimal FFI module for FazAI to satisfy expected symbols
#include <stdio.h>
#include <string.h>

#ifdef __cplusplus
extern "C" {
#endif

int fazai_mod_init(void) {
  return 0; // OK
}

// Expected by Node FFI: int fazai_mod_exec(const char* command, char* output, int output_len)
// Note: main.js declares ['int', ['string','pointer','int']]
int fazai_mod_exec(const char* command, char* output, int output_len) {
  if (!output || output_len <= 0) return -1;
  const char* cmd = command ? command : "";

  if (strncmp(cmd, "status", 6) == 0) {
    snprintf(output, output_len,
             "status: ok\nversion: 1.0\nfeatures: basic-ffi" );
    return 0;
  }
  if (strncmp(cmd, "echo ", 5) == 0) {
    snprintf(output, output_len, "%s", cmd + 5);
    return 0;
  }
  if (strncmp(cmd, "help", 4) == 0) {
    snprintf(output, output_len,
             "commands:\n  help\n  status\n  echo <text>\n");
    return 0;
  }
  snprintf(output, output_len, "unknown command: %s", cmd);
  return 0;
}

void fazai_mod_cleanup(void) {
  // noop
}

#ifdef __cplusplus
}
#endif

