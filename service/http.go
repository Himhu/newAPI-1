package service

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"

	"github.com/gin-gonic/gin"
)

func CloseResponseBodyGracefully(httpResponse *http.Response) {
	if httpResponse == nil || httpResponse.Body == nil {
		return
	}
	err := httpResponse.Body.Close()
	if err != nil {
		common.SysError(common.LogText("failed to close response body: %s", err.Error()))
	}
}

// ShouldCopyUpstreamHeader checks whether a given upstream response header
// should be copied to the client response. It returns false for Content-Length
// (managed separately) and X-Oneapi-Request-Id (to preserve the local instance
// ID). When the upstream header is X-Oneapi-Request-Id, the value is captured
// into the Gin context for later logging.
//
// Use this directly only when the caller already restricts itself to a small,
// explicit set of header names (e.g. relaying specific provider status
// headers). For copying an entire upstream response verbatim, use
// SanitizeUpstreamHeaders instead, which additionally enforces an allowlist.
func ShouldCopyUpstreamHeader(c *gin.Context, k string, v []string) bool {
	if strings.EqualFold(k, "Content-Length") {
		return false
	}
	if strings.EqualFold(k, common.RequestIdKey) {
		if c != nil && len(v) > 0 {
			c.Set(common.UpstreamRequestIdKey, v[0])
		}
		return false
	}
	return true
}

// allowedUpstreamHeaders lists response headers we relay to end clients when
// copying an entire upstream response. Everything else — upstream identity,
// tracing, and rate-limit headers — is dropped so downstream cannot
// fingerprint which upstream we called.
var allowedUpstreamHeaders = func() map[string]struct{} {
	names := []string{
		"Content-Type", "Content-Encoding", "Content-Language", "Content-Disposition",
		"Content-Range", "Accept-Ranges", "Cache-Control", "ETag", "Last-Modified",
		"Expires", "Retry-After", "Vary",
	}
	m := make(map[string]struct{}, len(names))
	for _, n := range names {
		m[http.CanonicalHeaderKey(n)] = struct{}{}
	}
	return m
}()

// SanitizeUpstreamHeaders copies allowlisted response headers from src to
// dst. It builds on ShouldCopyUpstreamHeader for Content-Length/request-id
// handling, additionally dropping any header not in allowedUpstreamHeaders.
func SanitizeUpstreamHeaders(c *gin.Context, dst, src http.Header) {
	if dst == nil || src == nil {
		return
	}
	for key, values := range src {
		if !ShouldCopyUpstreamHeader(c, key, values) {
			continue
		}
		if _, ok := allowedUpstreamHeaders[http.CanonicalHeaderKey(key)]; !ok {
			continue
		}
		dst.Del(key)
		for _, v := range values {
			dst.Add(key, v)
		}
	}
}

func IOCopyBytesGracefully(c *gin.Context, src *http.Response, data []byte) {
	if c.Writer == nil {
		return
	}

	body := io.NopCloser(bytes.NewBuffer(data))

	// We shouldn't set the header before we parse the response body, because the parse part may fail.
	// And then we will have to send an error response, but in this case, the header has already been set.
	// So the httpClient will be confused by the response.
	// For example, Postman will report error, and we cannot check the response at all.
	if src != nil {
		SanitizeUpstreamHeaders(c, c.Writer.Header(), src.Header)
	}

	// set Content-Length header manually BEFORE calling WriteHeader
	c.Writer.Header().Set("Content-Length", fmt.Sprintf("%d", len(data)))

	// Write header with status code (this sends the headers)
	if src != nil {
		c.Writer.WriteHeader(src.StatusCode)
	} else {
		c.Writer.WriteHeader(http.StatusOK)
	}

	_, err := io.Copy(c.Writer, body)
	if err != nil {
		logger.LogError(c, common.LogText("failed to copy response body: %s", err.Error()))
	}
	c.Writer.Flush()
}
