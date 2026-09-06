package client

import (
	"net/http"
	"net/url"
	"strconv"
)

// RequestOptions encapsulates query parameters, headers, and pagination settings.
type RequestOptions struct {
	Headers http.Header
	Params  url.Values
}

// RequestOption defines a functional option for customizing API requests.
type RequestOption func(*RequestOptions)

// ListOption is an alias for RequestOption used with list/query endpoints.
type ListOption = RequestOption

// NewRequestOptions applies a slice of functional options to a new RequestOptions instance.
func NewRequestOptions(opts ...RequestOption) *RequestOptions {
	ro := &RequestOptions{
		Headers: make(http.Header),
		Params:  make(url.Values),
	}
	for _, opt := range opts {
		if opt != nil {
			opt(ro)
		}
	}
	return ro
}

// WithHeader adds a custom HTTP header to the request.
func WithHeader(key, value string) RequestOption {
	return func(o *RequestOptions) {
		if o.Headers == nil {
			o.Headers = make(http.Header)
		}
		o.Headers.Add(key, value)
	}
}

// WithHeaders sets multiple custom HTTP headers on the request.
func WithHeaders(headers map[string]string) RequestOption {
	return func(o *RequestOptions) {
		if o.Headers == nil {
			o.Headers = make(http.Header)
		}
		for k, v := range headers {
			o.Headers.Set(k, v)
		}
	}
}

// WithQueryParam sets an arbitrary URL query parameter on the request.
func WithQueryParam(key, value string) RequestOption {
	return func(o *RequestOptions) {
		if o.Params == nil {
			o.Params = make(url.Values)
		}
		o.Params.Set(key, value)
	}
}

// WithStatus filters list results by resource status.
func WithStatus(status string) RequestOption {
	return WithQueryParam("status", status)
}

// WithSeverity filters list results by severity level.
func WithSeverity(severity string) RequestOption {
	return WithQueryParam("severity", severity)
}

// WithLimit sets the maximum number of items returned.
func WithLimit(limit int) RequestOption {
	return WithQueryParam("limit", strconv.Itoa(limit))
}

// WithOffset sets the pagination offset.
func WithOffset(offset int) RequestOption {
	return WithQueryParam("offset", strconv.Itoa(offset))
}

// WithPage sets the 1-based page index.
func WithPage(page int) RequestOption {
	return WithQueryParam("page", strconv.Itoa(page))
}

// WithPageSize sets the number of items per page.
func WithPageSize(pageSize int) RequestOption {
	return WithQueryParam("page_size", strconv.Itoa(pageSize))
}
